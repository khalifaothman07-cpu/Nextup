# Security

## Core pattern: never trust the client with identity, balance, or price

Every mutation that touches money (song purchases, wallet balances, trading positions) follows the same shape: the client calls an Edge Function with its own JWT; the function verifies that JWT with an anon-scoped Supabase client to get a real `user.id`; all actual writes happen through a service-role client calling a `SECURITY DEFINER` Postgres function that takes `user_id` as an explicit argument. RLS then locks the underlying tables (`wallets`, `positions`, `song_ownership`, `crypto_charges`, `wallet_deposits`) to owner-only reads and zero client-side writes — the only way money moves is through those trusted functions.

## `SECURITY DEFINER` functions: a near-miss worth documenting

While building `open_position`/`close_position`, the first attempt locked them down with:

```sql
revoke all on function open_position(...) from public;
grant execute on function open_position(...) to service_role;
```

The Supabase security advisor caught that this **did not work** — `anon` and `authenticated` could still call both functions directly via `/rest/v1/rpc/open_position`. Supabase grants `EXECUTE` on newly created functions to `anon`/`authenticated` directly, independent of the `PUBLIC` pseudo-role, so `REVOKE ... FROM PUBLIC` doesn't touch those grants. Since these functions trust their `p_user_id` argument completely, this would have let any signed-in (or anonymous) caller manipulate any other user's wallet or positions by passing an arbitrary user id.

**Fix, and the pattern to repeat for every future `SECURITY DEFINER` function**: `revoke execute ... from anon, authenticated, public;` explicitly, then `grant ... to service_role;`. Confirmed with `mcp__Supabase__get_advisors(type: "security")` after every migration that adds or changes a function — the advisor's `anon_security_definer_function_executable` / `authenticated_security_definer_function_executable` lints are the ground truth, not the migration succeeding.

**The exact mirror of that mistake, made in Cycle 13.** The three new `admin_*` write functions were locked down with `revoke execute ... from anon, authenticated;` — the fix above, minus one word. The advisor flagged all three as anon-callable, because `REVOKE ... FROM anon` leaves the `PUBLIC` grant untouched and `anon` inherits `EXECUTE` through `PUBLIC`. Two failure modes, opposite directions, one root cause: a function carries grants from more than one source, and revoking one source silently leaves the others standing. Migration `admin_functions_revoke_public` fixed it. The rule that survives both is to name all three every time — **`revoke execute on function ... from public, anon, authenticated;`** — then grant back only what is intended, and never assume a single revoke covered the rest.

## Two shapes of `SECURITY DEFINER` function, two different correct grants (Cycle 13)

"Always `service_role`-only" is the wrong summary of the rule above, and Cycle 13 is where the distinction had to be made explicit. What matters is not which role can call the function; it is **whether the caller gets to assert who they are**.

- **Takes `user_id` as an argument** — `open_position`, `close_position`, `credit_wallet`, `request_withdrawal`, `cancel_withdrawal_request`. The function believes whatever id it is handed, so a signed-in caller reaching it directly could operate on anyone's wallet. These must stay `service_role`-only, fronted by an Edge Function that derives the id from a verified JWT.
- **Derives identity from `auth.uid()` and checks the role itself** — `admin_review_application`, `admin_onboard_application`, `admin_set_feature_flag`, `admin_list_applications`, `admin_list_audit`. There is no id to forge: the function reads `auth.uid()` out of the request's JWT (which PostgREST has already validated before the function runs) and raises `not authorised` unless that user holds the `admin` role. Granting `EXECUTE` to `authenticated` is correct here — the grant is what lets a real admin's browser reach the function at all, and the in-function check is the actual gate. `anon` still gets nothing; `auth.uid()` would be null for it and the check would fail regardless, so revoking is belt and braces.

The advisor reports the second group as `authenticated_security_definer_function_executable`. That lint is right about the fact and wrong about the conclusion for these five, so it is accepted deliberately and recorded here — same as `track_ownership_public` and `waitlist_signups` — rather than "fixed" into an admin console no admin can use. The probe that proves the gate holds: a signed-in non-admin calling any of the five gets `ERROR: P0001: not authorised`, and a non-admin selecting from `audit_log` gets 0 rows.

A second, smaller version of the same lesson: `private.has_role()` needs `EXECUTE` granted to `anon`/`authenticated` (RLS policies that call it run as those roles), but it doesn't need to be reachable as a direct `/rpc/` endpoint (which would let anyone probe an arbitrary uuid's role membership). Fix was structural, not a grant: put it in a `private` schema that PostgREST doesn't expose, rather than `public`. RLS policy evaluation happens inside Postgres and can call functions in any schema; only PostgREST's HTTP surface cares about schema exposure.

## Found-and-fixed: free song-ownership via leftover INSERT policy (Cycle 8)

A routine policy audit before building the Account page found `song_ownership` still carried an `INSERT` policy — `"users can buy an unowned track"` `WITH CHECK (auth.uid() = user_id)` — left over from the pre-Coinbase prototype where purchases were client-side. Since the webhook writes via service role (which bypasses RLS), the policy served no legitimate caller; what it actually did was let any signed-in user insert their own ownership row for any unowned track, at any self-declared price, without paying. Dropped in migration `account_slice_fixes`. Lesson recorded: when a write path moves server-side, **delete** the client-side policy it replaced in the same change — the old policy doesn't break anything visibly, which is exactly why it survives. Worth a periodic `pg_policies` sweep against the "who is supposed to write this table" list in `docs/DATA_MODEL.md`.

## RLS policy audit (as of this pass)

Every table has RLS enabled. Two intentionally permissive policies exist, both reviewed and accepted rather than accidental:

- `waitlist_signups` allows anonymous `INSERT` with `WITH CHECK (true)` — it's a public lead-capture form by design.
- `track_ownership_public` is a `SECURITY DEFINER` view exposing only `track_id`/`owned_at` (never the buyer's identity) so the storefront can show "already owned" without needing RLS-bypassing reads on `song_ownership` itself.

Both show up in `get_advisors` and are left as-is deliberately — flagged here so a future pass doesn't "fix" them into breaking the product.

## Webhook security

`coinbase-webhook` verifies `X-CC-Webhook-Signature` via HMAC-SHA256 against `COMMERCE_WEBHOOK_SECRET` using a constant-time comparison before parsing or trusting anything in the request body. It's idempotent (a charge already `confirmed` is a no-op; the update that flips `pending -> confirmed` is conditioned on `.eq("status","pending")` so only one concurrent delivery can win and proceed to the entitlement/credit step).

## Rate limiting: what it does and does not do (Cycle 15)

Three properties worth being precise about, because each one is a real limit on the protection:

**A rejected request does not burn quota.** Postgres rolls back the counter increment along with the failed insert, so the guarantee is "at most N _successes_ per window", not "at most N _attempts_". That is the right behaviour — a user who trips a limit is not punished further for retrying — but it means the limiter caps successful abuse without reducing the load of a flood. Volume floods are Cloudflare's job, and Supabase already sits behind it.

**Fixed windows allow a 2× burst at the boundary.** Ten charges at 10:59 and ten more at 11:01 both pass. Accepted: the alternative is storing and counting every event, and the numbers here are chosen so that twice the limit is still harmless.

**Per-IP limiting is weak against anyone with an IP pool, and we proved it by accident.** The end-to-end test fired seven waitlist signups from one machine and every one succeeded — because this sandbox's egress IP rotates across a pool, so the seven landed in three different buckets and none reached five. That is exactly the bypass a datacenter, VPN or botnet has for free. The limit still stops casual and naive spam, and `waitlist_signups` has a unique constraint on email underneath it, but nobody should read "per-IP rate limited" as "protected". If waitlist spam ever becomes real, the answer is a CAPTCHA (Turnstile/hCaptcha), not a smaller number here.

**The IP itself is read from `cf-connecting-ip`**, which Cloudflare overwrites on every request and a client therefore cannot forge. `x-forwarded-for` is only a fallback, and only its _last_ hop is trusted — anything earlier in that header may have been supplied by the caller.

## Magic-link sign-in is Supabase's endpoint, not ours

The one surface a database trigger cannot reach. `signInWithOtp` posts to Supabase Auth directly, so there is no table to hang a trigger on and no function of ours in the path. Three things apply instead:

1. **Supabase's own auth rate limits** are the real control, and they are dashboard settings rather than code. Before launch, confirm the per-hour email limit and the per-IP sign-in limit under Auth → Rate Limits. The built-in SMTP has a low project-wide hourly ceiling, which is a shared fuse — one abuser exhausts it for every real user, so a custom SMTP provider should be configured at the same time.
2. **Enable CAPTCHA on auth** (Turnstile or hCaptcha, Auth → Settings). This is the actual defence against automated sign-in abuse and the only one that survives an attacker with an IP pool.
3. **The 30-second resend cooldown in `AuthWidget`** is politeness, not security — it lives in the page and anyone can bypass it. It is there because without it an ordinary person who doesn't see the email clicks "Sign in" four times in ten seconds and burns the shared quota on their own confusion.

## Known gaps (not yet addressed)

- **Closed, with one honest exception (Cycle 15).** Rate limits are enforced in Postgres by `BEFORE INSERT` triggers on `positions` (20/min and 200/hr per user), `withdrawal_requests` (5/hr), `crypto_charges` and `wallet_deposits` (10/hr), and `waitlist_signups` (5/hr per IP). They live on the tables rather than in the Edge Functions deliberately: a limit inside a function is skipped the moment somebody calls PostgREST directly, and all of these tables are reachable that way. Counters are fixed-window rows in `private.rate_counters`, GC'd nightly by pg_cron.
- **Partly closed (Cycle 13).** `artist_members` owner grants now happen through `/admin`'s "Create artist page", which is audited. `user_roles` grants (`admin`, `curator`) are still SQL-only and deliberately so: an admin console that can mint admins is a privilege-escalation surface, and there is no second-person approval or self-demotion guard to make that safe yet. Granting the first admin is documented in `docs/DEPLOYMENT.md`.
- **Closed (Cycle 13).** `audit_log` exists and every `admin_*` function writes to it. It covers admin actions only — moderation and role grants aren't recorded because neither has a code path yet. The table is append-only from the client's perspective: `INSERT`/`UPDATE`/`DELETE` are revoked from `anon` and `authenticated` with no policy granting them back, so an admin cannot edit or erase their own trail through the API.
- `jurisdiction_rules` exists as a schema stub only; nothing actually checks it before allowing a trade or backing action.
- No automated security testing (IDOR checks, RLS regression tests) — every check in this doc was done manually via `get_advisors` plus targeted `curl` probes against the anon key. A test suite that exercises RLS boundaries directly is a real gap for a platform handling money.
- `npm audit` flags two moderate advisories after the Cycle 6 framework migration: `react-router`/`react-router-dom` (open-redirect via backslash in `<Link>`/`useNavigate`, only exploitable if a redirect target came from untrusted input — nothing in this app does that yet) and `esbuild`'s dev-server CORS issue (dev-only, not present in the production `dist/` build). Both require a major-version bump (React Router v7) to clear; deferred rather than done reflexively mid-migration, since v7 has breaking API changes. Revisit before any feature actually accepts a user-supplied redirect/navigation target.

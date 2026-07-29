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

## Known gaps (not yet addressed)

- No rate limiting anywhere (auth, trade, checkout). The master prompt requires it (§20); not built this pass.
- No admin UI for granting `user_roles`/`artist_members` — grants currently require direct DB access. Real risk if this ships before an admin console exists to manage it safely.
- No audit log table yet — sensitive actions (role grants, moderation, admin overrides) aren't recorded anywhere.
- `jurisdiction_rules` exists as a schema stub only; nothing actually checks it before allowing a trade or backing action.
- No automated security testing (IDOR checks, RLS regression tests) — every check in this doc was done manually via `get_advisors` plus targeted `curl` probes against the anon key. A test suite that exercises RLS boundaries directly is a real gap for a platform handling money.
- `npm audit` flags two moderate advisories after the Cycle 6 framework migration: `react-router`/`react-router-dom` (open-redirect via backslash in `<Link>`/`useNavigate`, only exploitable if a redirect target came from untrusted input — nothing in this app does that yet) and `esbuild`'s dev-server CORS issue (dev-only, not present in the production `dist/` build). Both require a major-version bump (React Router v7) to clear; deferred rather than done reflexively mid-migration, since v7 has breaking API changes. Revisit before any feature actually accepts a user-supplied redirect/navigation target.

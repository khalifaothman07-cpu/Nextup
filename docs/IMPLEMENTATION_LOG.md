# Implementation Log

Newest entry first. Each entry follows the master prompt's §31 working-cycle format.

---

## Cycle 16 — The ledger, and what it found in the first hour

**Slice**: Board feedback, point 7: the operating-liquidity commitment "is not reflected in the architecture" and needs to be company-owned liquidity kept completely separate from customer balances. Founder: "Yes." Built deliberately as a shape that is **correct under every custody model**, because Decision 3 (does the company hold customer funds, use a custodian, or never take custody) is unanswered and the accounting underneath is the same either way.

**What it does**: `ledger_accounts` / `ledger_transactions` / `ledger_entries` sit underneath the money tables as an independent second record. Company account kinds (`company_operating`, `company_revenue`, `settlement`) and customer kinds (`customer_wallet`, `customer_escrow`) are distinct, with partial unique indexes so commingling is a schema error rather than a rule someone has to remember. Every movement writes matched entries; a `DEFERRABLE INITIALLY DEFERRED` constraint trigger refuses at commit any transaction whose entries don't sum to zero or that has fewer than two legs. Entries are posted by triggers on `wallet_deposits`, `positions` (insert and update), `withdrawal_requests` and `song_ownership` — on the tables, not in the callers, for the same reason the rate limiters live there. `/admin` opens with a treasury panel: obligations, holdings, coverage, per-kind totals, and a reconciliation row count, with a visible alert when coverage is negative or the books disagree with `wallets`.

**Nothing reads the ledger to make a decision.** `wallets.balance_cents` is still the operational balance and still the thing `open_position` checks. That is on purpose: the ledger's job is to be a second opinion, and a second opinion that the first one depends on is not one. Reconciliation between the two is the entire product of this slice — two records that agree prove something, one record proves nothing.

**And then it immediately found something worse than the gap it was built to close.**

`open_position` does `balance_cents - p_stake_cents`. The stake leaves the wallet and is written nowhere. `close_position` does `balance_cents + v_proceeds`. The proceeds are credited from nothing. **The bonding curve has no reserve behind it — money is destroyed on open and conjured on close.** No row is wrong, no constraint is violated, nothing throws, and the arithmetic is internally consistent, which is exactly why fifteen cycles of reading that code never surfaced it. What surfaces it is asking an independent record whether obligations are covered.

The probe, in a rolled-back transaction:

```
after $100 deposit — obligations       10000
after $100 deposit — holdings          10000
after $100 deposit — coverage              0
after $20 stake   — obligations         8000
after $20 stake   — coverage            2000
proceeds paid out                       2984
after profitable close — obligations   10984
after profitable close — holdings      10000
COVERAGE (negative = unbacked)          -984
ledger sums to zero                        0
```

One ordinary $20 trade on a $100 deposit produced a $9.84 liability with nothing behind it. Not a defect, not abuse — the product working as designed.

**This changes what board point 7 actually says.** The concern raised was "there is no treasury table." The accurate statement is that **the Backing product has no funding model**: nothing defines where a winning payout is funded from, what the maximum company exposure is, or what happens when obligations exceed holdings. Engineering can enforce a reserve; it cannot decide how large it should be. Written up as risk 0 in `docs/ARCHITECTURE.md` and as the rewritten Section 06 of the board appendix, where it is now the headline rather than a footnote. Deposits, withdrawals and track purchases are unaffected and reconcile cleanly — this is specific to `regulated_offerings`.

**Database** (migrations `ledger_foundation`, `ledger_posting_and_reconciliation`, `ledger_sign_convention_and_wiring`, `fix_treasury_position_types_v2`, `pin_ledger_balance_trigger_search_path`). Two functions, both the `auth.uid()`-deriving self-checking shape from Cycle 13: `admin_treasury_position()` and `admin_reconcile_wallets()`. Three tables with `SELECT`-only policies scoped to the caller's own accounts and **no write policy at all**, so `private.post_ledger` running as table owner is the only writer.

**Sign convention, stated because getting it backwards would be invisible**: assets positive, liabilities negative. A customer wallet is money owed, so its entries are negative. `coverage = holdings - obligations`. Reversed, every figure on the treasury panel stays plausible and is wrong — including, specifically, the one that says whether customer funds are intact. It is asserted by probe, not assumed.

**Verified:**

- Unbalanced transaction (100 / −99) → rejected at commit with `out of balance by 1 cents`. ✓
- Balanced transaction (100 / −100) → commits; deleting both legs also commits (a fully-deleted transaction is legal, a partial one is not). ✓
- Deposit of $100 → reconciliation reports 0 wallets out of sync, coverage 0. ✓
- A deliberate silent 777-cent edit straight to `wallets.balance_cents` → detected, with the exact drift. **This is the probe that matters**: it is the only one that could have failed quietly, and it is the reason to have a second record. ✓
- Trade lifecycle → the coverage table above. ✓
- Advisor after every migration; the one new lint (`private.assert_ledger_balanced` with a role-mutable `search_path`) fixed by pinning `search_path = ''` and fully qualifying, then re-probed to confirm the trigger still rejects and still permits the right things. Pinning a `search_path` on a working function and not re-testing it is how you turn a lint fix into an outage. ✓

**Two traps worth recording.** `sum()` over `bigint` returns `numeric`, so `admin_treasury_position()`'s first signature didn't match its own body — and `CREATE OR REPLACE VIEW` cannot change a column's type, so `ledger_position` had to be dropped and recreated rather than replaced. And the balance trigger has to be deferred: a balanced transaction is only balanced once all its legs are inserted, so a per-statement check would reject the first leg of every correct transaction.

**UI**: treasury panel first in `/admin` (`.treasury`, `.tre-fig`, `.tre-alert`), harness mocks added with `ADMIN_TREASURY` deliberately showing an uncovered position so the alert state is what gets reviewed rather than the happy path. Harness: 19 assertions pass, unstyled-class sweep clean, no page errors.

**Docs**: `docs/board-appendix.html` Section 06 rewritten around the finding, its status row moved from Gap to Partial, Decision 3 extended to ask for the reserve size alongside the custody model, and the roadmap's Phase 1 treasury line split into "decide and fund the reserve" plus "custody and settlement structure". `scripts/check-board-appendix.mjs` gained eight new banned terms covering the ledger internals.

**Remaining limitations**:

- **The reserve is measured, not enforced.** Nothing stops a position from opening when coverage is already negative, because the limit that would stop it hasn't been decided. Enforcement is a one-line check once there is a number to check against.
- The ledger is written by triggers on today's four money tables. Any future table that moves value needs its own posting trigger, and nothing yet fails loudly if one is forgotten — a reconciliation drift is the only signal.
- `customer_escrow` exists as an account kind and is unused. It is where staked funds belong under a reserve model; leaving it defined and empty is deliberate, so the shape doesn't have to change when the funding decision lands.
- Edge Functions remain undeployed (six of seven, four changed in Cycle 15 for 429 handling) — `bash scripts/deploy-functions.sh`, founder-run.

**Recommended next slice**: nothing that adds surface. The two items ahead of new features are the funding decision (founder + counsel, not engineering) and automated RLS/financial regression tests, which the last two cycles have made overdue — three of this project's four real security findings were caught by advisors or hand-probes that only ran because someone remembered to run them.

---

## Cycle 15 — Rate limiting, and being precise about what it buys

**Slice**: there was none, anywhere — auth, trade, checkout, waitlist. The master prompt asks for it (§20). It wanted doing _before_ the domain resolves rather than after.

**Where it lives, and why there**: `BEFORE INSERT` triggers on the tables, not checks inside the Edge Functions. A limit in a function is skipped the moment someone calls PostgREST directly, and every one of these tables is reachable that way. Edge Functions are also ephemeral and horizontally scaled, so an in-memory counter there counts almost nothing — the only shared state already available is the database, and using it costs no new infrastructure.

**Limits**: `positions` 20/min and 200/hr per user (a per-minute cap alone still permits a sustained grind; a per-hour cap alone still permits a burst), `withdrawal_requests` 5/hr, `crypto_charges` and `wallet_deposits` 10/hr, `waitlist_signups` 5/hr per IP.

**Verified against the real HTTP path, not just SQL.** The 6th withdrawal and 11th charge were refused at exactly the right counts, a second user was untouched (per-actor, not global), and an end-to-end curl run returned `HTTP 400 / P0001` with the hint intact.

**Three things worth being precise about, all now in `docs/SECURITY.md`:**

1. **A rejected request does not burn quota.** The counter increment rolls back with the failed insert, so the guarantee is "at most N _successes_ per window", not attempts. Correct behaviour — retrying is not punished — but it means the limiter caps successful abuse without reducing flood load.
2. **Fixed windows allow a 2× boundary burst.** Accepted; the alternative is storing every event, and twice these numbers is still harmless.
3. **Per-IP limiting is weak against an IP pool, and the test proved it by accident.** Seven waitlist signups from one machine all succeeded — this sandbox's egress IP rotates, so they landed in three buckets and none reached five. That is precisely the free bypass a datacenter or VPN has. Forcing one bucket over the line confirmed enforcement works; the limitation is real and is now written down rather than papered over. If waitlist spam becomes real the answer is a CAPTCHA, not a smaller number.

**The one surface a trigger cannot reach**: magic-link sign-in posts to Supabase Auth directly — no table, no function of ours in the path. Documented as what it is: Supabase's dashboard rate limits are the actual control, CAPTCHA on auth is the real defence, and the new 30-second resend cooldown in `AuthWidget` is politeness rather than security. It earns its place because without it a person who doesn't see the email clicks four times in ten seconds and burns a shared hourly quota on their own confusion — but it is client-side and says so in the code.

**User-facing copy**: `src/lib/errors.js` maps limits to sentences a person can act on; a raw `rate limit exceeded for wd:<uuid>` both reads as a crash and leaks an internal bucket key. The four Edge Functions that front money paths now return **429** with the same copy — needed because an Edge Function error arrives as an HTTP body, not a Postgres error code, so the client-side mapper cannot see it.

**Redeploy needed**: `trade`, `withdraw`, `create-charge` and `deposit` changed. `bash scripts/deploy-functions.sh`. The DB limits are already live and enforce regardless.

**Recommended next**: RLS regression tests — the structural gap the screenshot harness cannot cover, and the thing that would have caught the free-song-ownership policy in Cycle 8 automatically.

---

## Cycle 14 — Withdrawal fulfillment: taking the money path out of the SQL editor

**Slice**: chosen over the master prompt's next phase (community/commerce) and the founder agreed. Reasoning: every other step in the money path is now automated — purchase → webhook → ownership, deposit → webhook → credit, trade → locked function. Withdrawals were the exception. Marking one paid meant finding the row by hand and running an `UPDATE` in the Supabase SQL editor, with **no audit row, no check that it was still pending, and a `WHERE` clause one typo away from hitting the whole table**. Harmless while there is no money; the single riskiest thing in the system the day the Commerce account lands. Community, by contrast, would be designed blind for zero users.

**The correctness point the whole slice turns on**: `request_withdrawal` debits the wallet the moment the user asks, so by the time an operator sees the row the money is already gone from the balance. That makes the two outcomes asymmetric — **paid moves nothing, rejected must refund** — and getting it backwards in either direction silently takes money from a user. Pay-that-also-refunds double-spends; reject-that-doesn't-refund leaves them short with nothing sent.

**Database** (migration `admin_withdrawal_fulfillment`): `withdrawal_requests.tx_reference`; `admin_list_withdrawals` (pending first, joined to the payee's email in `auth.users` and their live wallet balance); `admin_mark_withdrawal_paid` (row lock, requires still-pending, **requires a non-empty tx reference**, no wallet movement, audit row); `admin_reject_withdrawal` (row lock, requires still-pending, credits the balance back, audit row). Same definer shape as the other admin functions — no `user_id` argument, identity from `auth.uid()`, `not authorised` otherwise.

**Verified with probes in rolled-back transactions** — the balance is the assertion that matters, and it is checked on both sides:

- balance after two requests → **2000** ✓
- mark paid → `paid`, balance **still 2000** ✓ (no double-spend)
- mark paid twice → `this withdrawal is already paid` ✓
- blank tx reference → `a transaction reference is required` ✓
- reject → `rejected`, balance **3000** ✓ (refund landed)
- reject twice → `this withdrawal is already rejected` ✓
- non-admin calling any of the three, including on their own row → `not authorised` ✓; `audit_log` still reads 0 rows for them ✓

**A probe that lied, and how**: the first run read the balance with a plain `select` from `wallets`. RLS correctly refuses an admin reading another user's wallet, so it returned `null` — and `null` compared against nothing, so every balance assertion silently passed without testing anything. Re-run through `admin_list_withdrawals` (definer, so it can see the row) and the real numbers appeared. A probe that cannot fail is worse than no probe.

**Frontend**: a Withdrawals section in `/admin`, built around not making a mistake. Amount is the largest thing on the card. The destination address is shown **whole, wrapped rather than ellipsised, and `user-select: all`** — a half-read address is how funds get lost, so the one string that must be copied exactly is the one thing always fully visible. Marking paid requires the transaction reference in the form, not just in the function. Settled requests stay below as a log with their tx hash or rejection reason.

**A defect caught by looking**: in the light theme the accent is a deep red (`#a32c24`) and `--down` is an orange-red (`#b3462f`). "Mark paid" and "Reject and refund" were two nearly identical red buttons on the one screen where confusing them costs money. Fixed by carrying the distinction in **treatment rather than hue** — filled means send the money, outlined means give it back — which also survives anyone who cannot separate the two reds.

**Verified**: 17/17 structural style-guard assertions (two new ones pin the address's `user-select` and the amount's size), unstyled-class sweep clean, zero page errors, advisor showing only the accepted lints plus the three intended `authenticated_security_definer_function_executable` warnings, `npm run build` and Prettier clean.

**Still true and still manual**: someone has to actually send the crypto. That does not change until a payout provider is integrated. What changed is that recording it is now an audited, idempotent, role-checked action instead of a hand-written UPDATE.

**Recommended next**: rate limiting. There is none anywhere — auth, trade, checkout — and the magic-link endpoint is an open email-sending faucet the moment the domain resolves. That wants doing before hosting, not after. Then RLS regression tests, which are the gap the screenshot harness structurally cannot cover.

---

## Cycle 13 — Phase 6: the admin console

**Slice**: Founder: "Start the next slice and keep doing it until there's a big enough change for a new preview." The next slice in `docs/ARCHITECTURE.md`'s sequence is Phase 6, the internal platform — and it was also the thing standing between Cycle 12's applications and anyone being able to act on them. `/apply` was collecting real rows into a queue nobody could open without a SQL client.

**What it does**: `/admin` is the second role-gated surface, and the first gated on a granted platform role rather than team membership. Three sections:

- **Application queue** — filtered by what needs a decision (open / accepted / declined, with counts). Each card shows the whole application plus the applicant's email, because the review workflow ends in "we email you" and a queue that can't tell you who to write to can't finish its job. Set a status, leave a note the applicant sees on `/apply`, or press **Create artist page**.
- **Feature flags** — real toggles on the real `feature_flags` rows, including `regulated_offerings`, the switch that hides or shows the entire Buy/Sell surface site-wide.
- **Audit log** — newest 50, with actor emails resolved.

**"Create artist page" is the interesting one.** It is the whole onboarding step in one transaction: slugify the artist name (with a uniqueness loop for collisions), insert the `artists` row and its bonding curve, insert the applicant's `artist_members` `owner` row, set `claimed_by_user_id`, mark the application accepted, link it back via the new `onboarded_artist_id`, and write an audit row. Before this, `docs/ASSUMPTIONS.md` #10 said memberships were "granted manually by the founder/operator via SQL" — five statements that had to be right and in the right order, by hand, per artist. It's a button now, and it either does all of it or none of it.

**Database** (migrations `admin_console_foundation`, `admin_functions_revoke_public`, `admin_console_reads`): `audit_log` (admin-read; `INSERT`/`UPDATE`/`DELETE` revoked from `anon`/`authenticated` with no policy granting them back — an admin cannot edit or erase their own trail through the API); `artist_applications.onboarded_artist_id`; and five `SECURITY DEFINER` functions — `admin_review_application`, `admin_onboard_application`, `admin_set_feature_flag`, `admin_list_applications`, `admin_list_audit`.

**A grant pattern that had to go the opposite direction.** Every prior definer function in this project is `service_role`-only, because they take `user_id` as an argument and would otherwise let a caller act as anyone. These five take no user id at all: they read `auth.uid()` themselves and raise `not authorised` unless that user holds `admin`. That inverts the correct grant — `authenticated` needs `EXECUTE` or a real admin's browser can't call them, and the in-function check is the actual gate. The rule was never "always `service_role`"; it is **never let the caller assert who they are**. Written up properly in `docs/SECURITY.md`, because "always `service_role`" was the wrong summary sitting in that doc and following it literally would have produced either an unusable console or an unsafe one.

**And the exact mirror of the Cycle 1 near-miss, made fresh.** I locked the three write functions down with `revoke execute ... from anon, authenticated` — the Cycle 1 fix minus one word — and the advisor immediately flagged all three as anon-callable, because `anon` inherits `EXECUTE` through the `PUBLIC` grant that revoke never touched. Cycle 1 was `REVOKE FROM PUBLIC` leaving the direct grants behind; this was `REVOKE FROM anon` leaving `PUBLIC` behind. Same root cause from the other side. Fixed in `admin_functions_revoke_public`, and the doc now says to name all three roles every time rather than trusting whichever one bit last.

**The read functions exist for one column, not for row visibility.** RLS already lets an admin select every application and every audit row. The email isn't in either table — it's in `auth.users`, which no client-facing policy can expose — so `admin_list_applications`/`admin_list_audit` do that join inside a definer function. Worth stating because "add an RPC" is usually the lazy answer to an RLS problem, and here RLS was already right.

**Verified — six probes, all in rolled-back transactions with synthetic `auth.users` rows and forged JWT claims:**

- Non-admin calls `admin_review_application` → `ERROR: P0001: not authorised`. ✓
- Non-admin calls `admin_list_applications` / `admin_list_audit` → same. ✓
- Non-admin selects from `audit_log` → **0 rows**. ✓
- Admin onboards end to end → `{"slug":"kite-season","curve_rows":1,"member_role":"owner","app_status":"accepted","linked":true,"audit_rows":1}` — slug correctly derived from "Kite Season!". ✓
- Onboarding the same application twice → `ERROR: P0001: this application already has an artist page`. ✓
- Grant table swept directly (`has_function_privilege`): all five functions `anon=false`, `authenticated=true`. ✓

Advisor: the two long-accepted lints, plus five `authenticated_security_definer_function_executable` warnings that are the intended design — documented rather than silently ignored.

**Frontend**: a `useRoles` hook (a display signal only — it decides whether the nav link is worth rendering; every action is re-checked server-side, so faking it in devtools yields a page of buttons that all answer "not authorised"). `/admin` route, admin-only nav link, and a sticky result bar, because an admin acting on the fifth card in a queue will not scroll to the footer to find out whether it worked. Non-admins who type the URL get an honest refusal that points artists at the dashboard — no request flow is offered, because none exists.

**Screenshots**: the harness now covers `/admin` at desktop and 390px, the non-admin refusal, and a third `navStrip` run with the admin link present — the nav gained a fourth link this cycle, which is exactly the change that produced the blob in Cycle 11. Mocking RPC meant teaching the harness that `/rest/v1/rpc/*` is a POST, and returning a real `P0001` for non-admins so the denied screenshot proves the denied path rather than an empty admin page.

**Deliberately not built**: a UI to grant `admin`/`curator`. A console that mints admins is a privilege-escalation surface, and there's no second-person approval, self-demotion guard, or admin-count floor to make it safe with one operator — `docs/ASSUMPTIONS.md` #11 states that, and `docs/DEPLOYMENT.md` gives the SQL for the first admin, which has to be SQL regardless since `auth.users` is empty until someone signs in. Also absent: moderation (nothing user-generated exists to moderate), a withdrawal-fulfillment queue (still the `update ... set status='paid'` documented in `docs/DEPLOYMENT.md`), and jurisdiction enforcement (`jurisdiction_rules` remains a stub nothing reads).

---

## Cycle 12 — `/apply`: artist applications, and a dead end I had created

**Slice**: Founder: "Where's the apply as an artist page". It didn't exist — I deferred artist onboarding in Cycle 9 (`docs/ASSUMPTIONS.md` #10). But the deferral had a consequence I hadn't checked: **the FAQ answer and the dashboard's empty state both told artists to "join the waitlist and note that you're an artist", and the waitlist form is a single email field with nowhere to note anything.** Two instructions on the live site that could not be followed. That is the "every visible action must work" rule broken by my own copy, not by a missing feature.

**The deferral reasoning was also wrong.** I had argued a form nobody can review would be fake functionality until Phase 6's admin console existed. But `withdrawal_requests` had already established the honest pattern for this exact shape: a real row, a real state machine, and a manual fulfillment step that is documented rather than pretended. Applications fit it precisely. There was no reason to wait.

**Database** (migration `artist_applications`): `artist_applications` with one row per account (`user_id` unique), length `CHECK`s on every text field, status in `pending|reviewing|accepted|declined`, plus `reviewed_at`/`review_notes`. Applicant inserts and reads their own; admin/curator read all via `private.has_role` so Phase 6 inherits a real review queue. `UPDATE`/`DELETE` revoked from `anon`/`authenticated` on top of having no policy — belt and braces on the one field that matters.

**Verified with four probes** (rolled-back transactions, `set local role authenticated` + forged JWT claims):

- Submit own application → **1 row**. ✓
- Read another user's application → **0 rows**. ✓
- Insert an application in another user's name → **`new row violates row-level security policy`**. ✓
- Applicant sets their own `status = 'accepted'` → **`permission denied for table artist_applications`** (grant rejects it before RLS is consulted). ✓

**Frontend**: `/apply` with three honest states — signed out (explains that an account is what lets you check status later and receive the dashboard), no application yet (the form: artist name, city, genre, where to hear you, what you're working on), and already applied (status pill, any review note, and exactly what was submitted). No invented SLA: it says a person reads it and replies by email, because that is what happens. Accepted **and** on a team → link to the dashboard; accepted but not yet set up says so rather than linking somewhere broken. Duplicate submit (23505) reloads into the status view instead of surfacing an error, since it isn't one.

**Dead ends closed**: FAQ answer now links to `/apply`; dashboard empty state points artists at `/apply` and offers a status check; "Apply as an artist" added to the footer. The preview template's hand-authored FAQ carried the same stale copy and was fixed too — verified by asserting the string "note that you're an artist" no longer appears anywhere in the preview.

**Harness hardening** (it is load-bearing now, so its own failures matter): the run OOM'd Chromium on the last of 8 full-page 2× captures. Dropped to 1.5× (still crisp, ~44% fewer pixels) and wrapped every capture in `tryShot`, so one crashed screenshot reports itself as an error instead of aborting the run and hiding every later result.

**Verified**: advisor clean (same two accepted lints); `npm run build` clean; both new `/apply` states screenshotted and reviewed by eye; preview asserts pass with zero page errors; `npx prettier --write .` clean.

**Still deferred, honestly**: accepting an application does not auto-create the artist page or grant `artist_members` — that stays a deliberate operator action, and Phase 6's console is where reviewing/accepting gets a UI instead of SQL.

---

## Cycle 11 — The nav blob: four layout defects, two of them mine from the previous cycle

**Slice**: The founder sent a photo of the header on their phone: "GET EARLY ACCESS" wrapped onto three lines, the `border-radius: 100px` pill ballooned into a blob, sitting on top of the sign-out link. Not a subtle regression — a photograph of it was the bug report.

**Root cause**: `.nav-cta` never had `white-space: nowrap`. Harmless while the nav held only a logo, the auth widget and one button; I then added Discover (Cycle 7), Account (Cycle 8) and Dashboard (Cycle 9) links **without re-checking narrow widths**, the row ran out of space, and the button wrapped.

**Four defects, found by widening the check rather than guessing:**

1. **The blob** — no `nowrap` on `.nav-cta`/`.nav-link`. Fixed.
2. **Signed-in email collapsed to 0px** on mobile, so the account state was invisible. The old `@media (max-width:480px)` rule set `min-width: 0` on the auth widget and let flex crush it. Now truncates via `max-width: 42vw` with the links on their own row.
3. **Sign-in input crushed** to "yo" at 430px and to an empty circle at 390px — only visible _after_ fixing the blob, since the signed-out path renders the CTA and the input side by side. Same root cause as the blob: a 100px radius on an element squeezed to ~40px. Fixed with a hard `min-width: 132px` floor plus hiding the CTA below 620px (it only scrolls to a waitlist form already on screen in the hero at that width, so it is the redundant element, not the sign-in field).
4. **A cascade collision I introduced during this very fix** — the `@media (max-width:620px) { .nav-cta { display:none } }` block landed _before_ the base `.nav-cta { display:inline-block }`. Equal specificity, so source order decided and the base won: the fix silently did nothing. Caught by checking rule order in the output file rather than assuming the rule applied. This is exactly the "watch your selector specificities / structure the cascade so it doesn't silently undo your spacing" failure mode.

**Structural change**: nav links moved out of `.nav-right` into their own `.nav-links` group, a direct child of `nav.wrap`. Desktop: right-aligned beside the auth cluster via `margin-left:auto`. Below 700px: `order: 3; flex: 1 0 100%` drops them to a full-width second row, so nothing in the nav has to shrink below its natural width. "Get Early Access" is now also hidden whenever a session exists — offering early access to someone who already has an account was always nonsense, and it removes the widest element from the crowded case.

**Process failure worth naming**: the blob was in `shot-account-mobile.png`, generated and reviewed by me one cycle earlier. I looked at that image and missed it, because I checked the content sections I had just written and treated the header as background furniture. Building the harness was not sufficient; "look more carefully" is not a control.

**So the harness now asserts on chrome** (`navStrip` in `scripts/screenshot.mjs`): renders the header at 1280/900/700/560/430/390/360, stitches the strips into one reviewable image, and **fails the run** on CTA wrap, horizontal page overflow, collapsed auth email, or a sign-in input under 120px — in **both** signed-in and signed-out states.

**Two harness bugs found and fixed while building it** (a check you cannot trust is worse than no check, because it trains you to ignore output):

- Line counting by `height / 18` counted the button's 11px padding as a second line and reported a wrap at 1280px, which is impossible. Replaced with real rendered line-box counting via `Range.getClientRects().length`, then **validated against a control** (`nowrap` button → 1 line, force-wrapped button → 3) before trusting it.
- The first version of the strip only ran signed-in — where the CTA is now hidden — so it could not have caught the founder's actual bug. Added a second, session-free browser context specifically to exercise the CTA.

**Verified**: all assertions pass at all 7 widths in both auth states, `hOverflow=false` throughout, zero page errors; both stitched strips reviewed by eye. `npm run build` clean, `npx prettier --write .` clean.

---

## Cycle 10 — Actually looking at the screens: four defects, and a harness so it can't recur

**Slice**: The founder said "you're saying these are built but I'm not seeing anything actually visual." Entirely fair, and two failures on my side: (1) the published preview artifacts were Cycle-7 snapshots, so Cycles 8–9 were literally invisible to them; (2) `/account` and `/dashboard` sit behind auth, which a static snapshot can never show — so "here's a preview link" was never going to work for them. I had been reporting `npm run build` + a DOM-presence smoke as verification, which proves a page _mounts_, not that it's _right_.

**Fix**: built `scripts/screenshot.mjs` (`npm run shots`) — renders the real production build in headless Chromium, fakes a Supabase session in `localStorage`, and fulfils `/rest/v1/*` with realistically-shaped rows, so the signed-in pages render from the actual React code. Documented in `README.md` as part of finishing a UI change, not an optional extra.

**Four real defects it caught immediately, all already committed:**

1. **Money was rounded to whole dollars.** `formatUSD` used `maximumFractionDigits: 0` — fine for whole-dollar track prices, wrong everywhere else it had since been reused: a $47.50 wallet balance displayed as "$48", a $2.01 curve price as "$2", a $1.04 entry price as "$1". The curve price hiding cents is the worst of it, since cent-level movement is the entire point of the bonding curve. Fixed with a cents-when-nonzero rule ($49 stays "$49", $47.50 shows "$47.50").
2. **`"content_editor".replace("_", "&")`** in `Account.jsx` rendered the role chip as "CONTENT&EDITOR". A typo; `Dashboard.jsx` had the correct `" "` two files over.
3. **"1 songs purchased"** in the dashboard's momentum sentence. Added a `plural()` helper.
4. **Tool pages inherited marketing-page spacing** (88px sections, 48px headings), so Account and Dashboard read sparse and document-like instead of dense and operable. Added an `.app-shell` scope tightening rhythm on signed-in pages.

**Three false alarms worth recording**, all caused by my mock being less faithful than PostgREST: it ignored `id=in.(...)` (so Account appeared to list 3 owned songs when the app correctly queries and renders 1), ignored `?limit=`(so the artist page's momentum panel appeared missing when `limit(1).maybeSingle()` was handed 7 rows), and I initially matched against the raw percent-encoded query string. Each was verified as a mock artifact — not an app bug — before changing anything. **A low-fidelity mock invents bugs that don't exist and hides ones that do**; the harness now honours limit, `in.()`, and the single-object Accept header, and says so in its header comment.

**Verified**: `npm run build` clean; six full-page screenshots (Account, Dashboard, Artist, Discover at desktop; Account + Dashboard at 390px) reviewed by eye, zero page errors, every fix confirmed visually rather than assumed. `npx prettier --write .` clean.

**Process change**: "the build passes" is no longer an acceptable verification claim for a UI change in this log. Screens get looked at.

---

## Cycle 9 — Phase 4 (first part): artist dashboard + team profile editing

**Slice**: Artist operations per §15 and the founder's "go on" — the artist-facing dashboard and the first role-gated **write** in the system (artist profile editing by team members). Artist onboarding/verification explicitly deferred (`docs/ASSUMPTIONS.md` #10): a self-serve submission form nobody can review would be fake functionality until Phase 6's admin console exists; pre-launch team memberships are granted manually.

**Database** (migration `artist_team_profile_editing`): two-layer write control on `artists` —

1. Column-level grants: blanket `UPDATE` revoked from `anon`/`authenticated` (Supabase grants it by default), re-granted only on the profile columns (`name, tagline, bio, genre, city, accent_from, accent_to`). RLS can't restrict columns; grants can. Structural/financial columns (`slug`, `follower_count`, `sort_order`, `stat_30d_pct`, `claimed_by_user_id`) are un-updatable from any client role. The `follower_count` trigger is unaffected (runs as function owner).
2. RLS policy: update allowed only where an `artist_members` row exists for `auth.uid()` with role `owner`/`manager`/`content_editor`. The membership subquery evaluates under the caller's own-rows RLS on `artist_members`, which is exactly the visibility the check needs.

**Verified at the DB level with three probes** (all inside rolled-back transactions, run under `set local role authenticated` + forged JWT claims):

- Non-member update → **0 rows** (RLS blocks silently). ✓
- `follower_count` update → **`permission denied for table artists`** (column grant rejects before RLS is even consulted). ✓
- Synthetic `content_editor` member updating `tagline` → **1 row**. ✓ (First attempt at this probe returned a false negative — the identity-lookup subquery ran after the role switch and was blinded by RLS; probe was fixed to capture identity before switching. Noted so future probes don't repeat it. `auth.users` is empty in this project — nobody has signed in yet — so the positive probe required a synthetic user, rolled back.)

**Frontend**: new `/dashboard` route (`src/pages/Dashboard.jsx`) + `useMemberships` hook; Header shows a Dashboard link only for users with team memberships. Signed-out and no-membership states are honest prompts (the latter explains manual pre-launch granting and points artists at the waitlist). With membership: artist switcher (multi-team users), stat tiles from real data only (followers, momentum score + weekly component sentence, live curve price, songs sold + gross **labeled** as at list price since actual sale prices are buyer-private), day-by-day momentum history with deltas (up/down colored, "first snapshot" for the oldest), and the profile editor (shown only to editing roles; non-editing roles like `a_r`/`finance_viewer` see read-only with an explanation — and the DB enforces it regardless of what the client shows). CSS: `.dash-stats`/`.dash-stat`, `.momentum-history`/`.mh-row`, `.dash-form`/`.dash-field`.

**Verified (frontend)**: `npm run build` clean. Headless-Chromium smoke: signed-out `/dashboard` renders the sign-in prompt, no Dashboard nav link without membership, zero page errors. `npx prettier --write .` clean. Advisor: clean (same two accepted lints).

**Not done / explicitly deferred**: artist onboarding + verification submission (needs Phase 6 review surface — see `docs/ASSUMPTIONS.md` #10); content publishing/timeline (community territory, Phase 5); team management UI (adding/removing members — needs the same admin/owner write-policy design as Phase 6); accent-color editing (grant exists; left out of the form until there's a color-input treatment that fits the design system rather than two raw hex fields).

**Recommended next step**: Phase 5 (community: artist posts + timeline on the profile page, supporter-gated where appropriate) or Phase 6 (admin console: memberships, verification review, feature flags, audit log) — Phase 6 unblocks artist onboarding, so it's the better pick if cohesion stays the priority.

---

## Cycle 8 — Phase 2.5, Account & role surface (+ a real security fix)

**Slice**: The master prompt arrived as a document this cycle (now the standing spec file; contents match what's been executed since it was first pasted — the two founder overrides on record still supersede it: no subscriptions, crypto-only payments). Per its §4 Listener requirements ("build a profile, track personal discovery history") and the working sequence: an `/account` page and role-aware navigation — the prerequisite for Phase 4's artist dashboard.

**Security fix found during pre-work policy audit**: `song_ownership` still had a client `INSERT` policy ("users can buy an unowned track") left over from the pre-Coinbase prototype — since the webhook writes via service role, the policy's only real effect was letting any signed-in user insert their own ownership row for any unowned track without paying. Dropped in migration `account_slice_fixes`; recorded in `docs/SECURITY.md` as a second "found-and-fixed" entry with the general lesson (when a write path moves server-side, delete the client policy it replaced in the same change). Same migration backfilled missing `profiles` rows for pre-trigger users and added an owner-insert policy so the account page's upsert self-heals. Advisor re-checked: clean (same two known accepted lints).

**Files changed**: new `src/pages/Account.jsx` (+ route in `App.jsx`); `Header.jsx` shows an Account link when signed in; `css/styles.css` gains `.role-chips`/`.role-chip`. Reused existing components/classes throughout (`ArtistCard` for the following grid, `positions-list`/`track-list` rows, `PageHero`).

**What the Account page actually is**: signed-out visitors get an honest sign-in prompt (no fake content). Signed in: editable display name (profiles upsert under owner-only RLS); role chips where **Listener** is always shown, **Supporter** is derived live from actually holding a position or owning a song (per the spec: derived, never a stored role), and any granted `user_roles`/`artist_members` roles appear as chips; following grid (reuses ArtistCard + momentum); wallet balance with pending-withdrawal cancel (same `cancel-withdrawal` Edge Function as the artist page); open positions across all artists with a Manage link to each artist page (closing stays on the artist page next to the live price, deliberately); owned songs with purchase price. Empty states link to Discover instead of dead-ending.

**Verified**: `npm run build` clean. Headless-Chromium smoke with mocked `/rest/v1/*` responses (same technique as Cycle 7, sandbox blocks live Supabase): signed-out `/account` renders the sign-in prompt; the header omits the Account link when signed out. Signed-in state paths exercised at the query level against real RLS policies (`pg_policies` audit above confirms every table the page reads is owner-scoped). `npx prettier --write .` clean.

**Not done / explicitly deferred**: gated admin/curator routes (their surfaces are Phases 4–6; empty gated routes would be dead navigation, which the spec forbids); artist-team dashboards (Phase 4); notification preferences (Phase 6 territory).

**Recommended next step**: Phase 4 — artist operations (artist onboarding + profile editor + the artist-facing dashboard reading real analytics), now that roles have a visible surface to hang off.

---

## Cycle 7 — Phase 2, Discovery vertical slice: follows, search/filter/sort, real momentum

**Slice**: First post-migration slice per the founder's "bit by bit, cohesive" direction and `docs/ARCHITECTURE.md`'s sequence: make discovery real. Three connected pieces — follows, roster search/filter/sort, and an honestly-computed momentum engine replacing the fabricated seeded stats.

**Database** (project `djnsjtlkjgjqmfcucjqp`, two migrations: `discovery_follows`, `discovery_momentum_engine`):

- `artist_follows` — own-rows-only RLS on select/insert/delete; the public never sees who follows whom, only the aggregate. `artists.follower_count` added as a public counter maintained solely by the `private.bump_follower_count()` SECURITY DEFINER trigger (standard revoke pattern applied on creation).
- `artist_momentum_daily` — historized daily snapshots, public read, written only by `private.compute_momentum()` (SECURITY DEFINER, execute revoked from `anon`/`authenticated`/`public`). Score = `follows_7d×3 + trades_7d×5 + purchases_7d×8 + $10-blocks traded`, with every component stored so the UI can show exactly why a score is what it is. Scheduled via pg_cron (`compute-momentum-daily`, 00:15 UTC daily; pg_cron extension installed this cycle) and run once immediately — first snapshot verified in-database: all five seed artists at score 0, which is the honest state (no real activity exists yet).
- Post-DDL security advisor check: no new findings; the only ERROR-level lint remains the pre-existing, deliberate `track_ownership_public` view, whose definition was re-verified this cycle to expose only `track_id`/`owned_at` (no user identity).

**Frontend**:

- `Discover` page rebuilt: text search (name/genre/city), genre filter chips derived from live data, sort by Momentum (default) / Name / Newest / Featured. Filtering is client-side over the fetched roster — correct and honest at 5 artists; revisit server-side filtering with pagination when the roster is big enough for it to matter.
- New shared `ArtistCard` used by both Home's roster row and Discover's grid (previously duplicated markup, one of which showed the fabricated `stat_30d_pct`). Cards now show two real numbers only: 7-day momentum score and follower count.
- Artist page: fabricated "▲ X% last 30 days" pill replaced with live follower count + `FollowButton` (direct RLS-guarded writes to `artist_follows` — no Edge Function needed, users can only touch their own rows; count refetches after toggle since the trigger owns the increment). New `MomentumPanel` shows the score with its full component breakdown and the "computed from real activity only" provenance note.
- Header gains a Discover nav link (site previously had no top-level nav to the roster).
- The one remaining "▲ 212%" on the site is the Home hero's stylized tap-demo card — an illustrative mock of the profile concept, not a data surface; left as-is deliberately and noted here.

**Verified**: `npm run build` clean (110 modules). Because the sandbox proxy blocks live Supabase calls, the headless-Chromium smoke against `npm run preview` fulfilled the `/rest/v1/*` requests in-page with the same row shapes the real database returned via SQL — exercising the actual UI wiring end-to-end: Home and Discover render shared cards showing real momentum ("▲ 14") and follower counts; Discover's genre chips derive from data, search ("lagos" → 1 card) and momentum sort (highest first) behave correctly; the artist page renders the follower pill, Follow button, momentum panel with full breakdown, and trading panel; the fabricated "% last 30 days" string appears nowhere. Live data path separately verified in SQL (first snapshot present for all 5 artists, all score 0 — honest). One smoke false-alarm worth recording: a first mock returned 2 rows for a `limit=1` `maybeSingle` query, which supabase-js correctly rejects — mock artifact, not an app bug. `npx prettier --write .` clean.

**Not done / explicitly deferred**: `ArtistSave` folded into follow rather than built as a near-duplicate; trend-over-time momentum charts (needs multiple daily snapshots to exist first — the data starts accruing now); a "following" feed/dashboard for listeners (belongs with the RBAC-aware UI slice); server-side search pagination (pointless at 5 artists).

**Recommended next step**: Phase 2.5 — RBAC-aware UI (role display, gated routes for admin/curator/artist-team, and a "following" view for listeners), now that discovery generates the activity those surfaces would show.

---

## Cycle 6 — Framework migration: React + Vite

**Slice**: Founder instruction: "Build everything that's scoped out." Nearly everything still missing (RBAC role UI, ledger, marketplace, community, artist dashboard, A&R pipeline, admin console, momentum engine) needs role-gated dashboards, kanban boards, and feeds — genuinely hard to build cleanly in hand-written vanilla JS/`innerHTML`. `docs/ASSUMPTIONS.md` #2 had already flagged this fork as something to confirm with the founder before Phase 2, not decide silently, so asked via `AskUserQuestion` before writing any code: (1) introduce a framework now vs. keep vanilla JS — founder chose framework; (2) work the documented sequence one real slice at a time vs. pick a single highest-priority feature — founder chose the sequence. This cycle is that first slice: the framework migration itself, since it blocks everything else in the sequence.

**What changed and why**: Migrated the entire site from static multi-page HTML to React 18 + Vite + `react-router-dom`, 1:1 functional parity with the pre-migration site — same routes' content, same Supabase queries, same trading/wallet/withdrawal logic, no visual redesign bundled in (kept the existing `css/styles.css` almost verbatim; the §5 rebrand stays its own deferred decision per `docs/ASSUMPTIONS.md` #3).

**Files changed**:

- Removed: all 11 root `*.html` files, `js/app.js`, `js/supabase-client.js`.
- Added: `vite.config.js`, root `index.html` (now the Vite SPA shell), `src/main.jsx`, `src/App.jsx` (routes), `src/context/SessionContext.jsx` (auth state via React context, replacing the old `initAuthWidget(el, onChange)` DOM-injection pattern), `src/components/*` (`Header`, `Footer`, `Logo`, `AuthWidget`, `WaitlistForm`, `ScrollManager`, `Breadcrumb`, `PageHero`, `Layout`, `TrackList`, `BackingPanel`, `TradingPanel`), `src/pages/*` (one component per route, including `NotFound` for unmatched paths — a real 404 page, not a dead end), `src/hooks/useReveal.js` + `usePageTitle.js`, `src/lib/supabaseClient.js` + `format.js` + `waitlist.js`, `public/_redirects` (Netlify-style SPA history-fallback rewrite), `.gitignore` (didn't exist before — now excludes `node_modules/`, `dist/`).
- `package.json` — added `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js` (moved off the `esm.sh` CDN import now that a real build step exists), `vite`, `@vitejs/plugin-react`; added `dev`/`build`/`preview` scripts.
- `supabase/functions/create-charge/index.ts`, `supabase/functions/deposit/index.ts` — updated Coinbase Commerce `redirect_url`/`cancel_url` from `artist.html?slug=X&charge=success` to `/artist/X?charge=success`, matching the new `/artist/:slug` route. Along the way, fixed a latent bug: the old `artist.html` script only checked `?charge=`/`?support=` query params for the post-checkout banner, but `deposit`'s redirect actually used `?deposit=` — so a successful wallet deposit never showed the "payment received" message. `Artist.jsx` now checks both `?charge=` and `?deposit=`.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/ASSUMPTIONS.md` (#2 update), `docs/SECURITY.md` — updated for the new stack, build step, hosting requirements (SPA history-API fallback), and two `npm audit` advisories (`react-router` open-redirect, `esbuild` dev-server CORS) knowingly deferred rather than force-upgraded mid-migration, since both require a breaking React Router v7 bump and neither is currently exploitable (no user-supplied redirect targets exist anywhere in the app).
- `docs/ARCHITECTURE.md`'s implementation sequence — dropped the stale "Phase 1.5 — Restore default support flow" line, which described reintroducing the tiered support model the founder explicitly killed back in Cycle 3; it should have been corrected then and wasn't caught until this pass.

**Verified**: `npm run build` succeeds (106 modules, no errors). Ran a headless-Chromium smoke test (`playwright`, temp dev-only install) against `npm run preview` across all 12 routes (`/`, `/artist/marra-vale`, `/how-it-works`, `/pricing`, `/discover`, `/about`, `/faq`, `/press`, `/terms`, `/risk-disclosure`, `/privacy`, and an unmatched path) — every route rendered its expected title and content. The only console errors were `net::ERR_CONNECTION_RESET` on Supabase calls, the same sandbox-proxy networking limitation documented earlier in this project's history (not a code defect — every affected loading state fell back to its "still loading" copy correctly rather than crashing). `npx prettier --write .` clean.

**Not done / explicitly deferred**: no ESLint config yet (a real gap now that JSX/hooks exist — flagged in `docs/ARCHITECTURE.md`'s tooling line, not silently skipped). Env-var injection for the Supabase URL/key wasn't wired up despite the new build step existing, since neither value is secret and there's no staging/prod split yet to justify it. The two `npm audit` advisories above. Edge Function deployment and real Coinbase Commerce credentials remain the same standing blockers as every prior cycle.

**Recommended next step**: per the founder's "work the sequence" direction — Phase 2 (Discovery vertical slice: real search/filter/sort on the roster, follow/save an artist, on top of an honestly-computed momentum score) or Phase 2.5 (RBAC-aware UI: surface the existing `profiles`/`user_roles`/`artist_members` schema as actual role display and gated routes). Both are now unblocked by this migration and are the logical next slices in `docs/ARCHITECTURE.md`'s sequence.

---

## Cycle 5 — Split the site into dedicated pages, fix stale pricing, kill dead legal links

**Slice**: Founder feedback: "There's still tiers and don't take the easy way out of putting everything into two pages create a separate detail landing page for each thing." Two problems: `index.html`'s `#pricing` section still described the $25/$50/$100 Supporter/Believer/Insider tiers removed in Cycle 3, and the whole site was two anchor-linked mega-pages, including three footer LEGAL links (Terms, Risk disclosure, Privacy) that went nowhere (`href="#"`).

**Files changed**:

- New pages: `how-it-works.html`, `pricing.html`, `discover.html`, `about.html`, `faq.html`, `press.html`, `terms.html`, `risk-disclosure.html`, `privacy.html`.
- `index.html` — rewritten to a real landing page: hero, the Marra Vale interactive demo (kept as the flagship hook), a live roster teaser linking to `discover.html`, and two rows of teaser cards linking to the six topic pages, instead of holding all of their full content inline. Footer LEGAL links now point at the three new pages instead of `#`.
- `artist.html` — footer expanded from a bare legal blurb to the same full PRODUCT/COMPANY/LEGAL nav used everywhere else, so an artist profile isn't a navigation dead end.
- `css/styles.css` — added `.page-hero`, `.teaser-row`/`.teaser-card`, `.discover-grid`, and `.content-page` (legal-page typography) to support the new page shapes; reused existing `.tiers`, `.sides`, `.faq`, `.about-grid`, `.press-contact` classes rather than duplicating them.
- `docs/ARCHITECTURE.md`, `README.md`, `docs/ASSUMPTIONS.md` (#9) — updated to describe the multi-page structure and flag that `terms.html`/`risk-disclosure.html`/`privacy.html` are agent-drafted, not lawyer-reviewed.

**Pricing fix specifics**: `pricing.html` replaces the stale tier cards with what's actually built — a flat per-track price for Song Ownership (artist-set, ~$34–$59) and no-fixed-tier bonding-curve trading for Backing — plus the three real hard minimums pulled straight from the Edge Function validation: $10 minimum deposit (`deposit`, `MIN_DEPOSIT_CENTS`), $1 minimum trade stake (`trade`, `stakeCents >= 100`), $10 minimum withdrawal (`withdraw`, `amountCents >= 1000`).

**Verified**: `npx prettier --write .` clean; `node --check` on every extracted inline `<script type="module">` across all 11 HTML files; `python3 -m http.server` + `curl` returned `200` for every page including `artist.html?slug=marra-vale`; grepped the whole site for `href="#"` and stale tier copy ("Supporter"/"Believer"/"Insider"/"TIER 0") — zero matches.

**Not done / explicitly deferred**: `terms.html`, `risk-disclosure.html`, and `privacy.html` are substantive, product-accurate drafts, not legal advice, and have not been reviewed by counsel — flagged in `docs/ASSUMPTIONS.md` #9 rather than treated as launch-ready. Edge Function deployment and real Coinbase Commerce credentials remain unchanged blockers from prior cycles (`docs/DEPLOYMENT.md`).

**Recommended next step**: same standing blockers as Cycle 4 — deploy the seven Edge Functions and configure real Coinbase Commerce credentials — plus a legal review pass on the three new policy pages before Nextup opens to the public.

---

## Cycle 4 — Enable `regulated_offerings`

**Slice**: Founder instruction: "Flip the switch and go well deal with all legal issues and licenses on our end." Flipped `feature_flags.regulated_offerings` from `false` to `true` via direct SQL update (`update feature_flags set enabled = true ... where key = 'regulated_offerings'`) — no code change, no migration needed.

**What changed and why**: This flag was the one deliberate go/no-go gate this project had been treating as the founder's call, not an agent judgment call (see `docs/DEPLOYMENT.md`). The founder made that call explicitly and took ownership of the legal/jurisdiction side, so flipping it was correct to execute directly rather than re-litigate.

**Verified**: confirmed the flag reads `true` via the anon key (`GET /rest/v1/feature_flags?key=eq.regulated_offerings`) — i.e. what the actual site code reads, not just the DB row.

**What this does and doesn't unlock**: with the flag on, `artist.html` will render the real trading panel (price ticker, Buy/Sell, wallet bar with deposit/withdraw) instead of the "not open yet" message — _if_ the site were deployed anywhere, which it still isn't. Clicking any action in that panel (deposit, trade, withdraw, buy a song) calls a Supabase Edge Function, and **none of the seven Edge Functions are deployed yet** — that blocker is unchanged from every prior cycle (`deploy_edge_function` tool calls have been interrupted/declined each time attempted, most recently again this cycle) and Coinbase Commerce credentials still aren't configured. So the flag flip is real and correctly wired, but on its own it does not yet make backing functional end-to-end — see `docs/DEPLOYMENT.md` for the remaining steps and who needs to do each one.

**Recommended next step**: deploy the Edge Functions (needs tool approval or manual `supabase functions deploy` per `docs/DEPLOYMENT.md`) and set up the real Coinbase Commerce account/credentials — both are prerequisites to the trading panel actually working once the site is live, independent of this flag.

---

## Cycle 3 — Reverse the tier model: deposit/withdraw is the backing flow

**Slice**: Direct founder correction of Cycle 2 — "We're not doing subs we're doing deposit and withdraws." Confirmed scope via two quick questions: remove the tier/subscription model entirely, and keep the bonding-curve Buy/Sell system (not a plain transfer) as what "backing" means, with deposit/withdraw as its wallet funding/cashout layer.

**Files changed**:

- Dropped `support_tiers`, `support_subscriptions`, `support_payments` and the `record_support_payment_confirmed` function (migration `remove_tier_subscription_model`) — all three tables held zero real user data (only fictional seed rows), so this is a clean revert, not a destructive one.
- New tables/functions (migration `wallet_withdrawals`): `withdrawal_requests`, `request_withdrawal()`, `cancel_withdrawal_request()` — same locked-down `SECURITY DEFINER`/`service_role`-only pattern as every other money-moving function here.
- Removed `supabase/functions/support-artist/`; added `supabase/functions/withdraw/` and `supabase/functions/cancel-withdrawal/`.
- `supabase/functions/coinbase-webhook/index.ts` — removed the `support_payments` branch, back to two flows (song purchase, wallet deposit).
- `artist.html` — removed `renderTierPanel` entirely; `renderBackingPanel` is back to a simple dispatcher (trading panel if the flag is on, an honest "not open yet" message if it's off — no tier UI in between anymore). `renderTradingPanel`'s wallet bar gained a Withdraw button and a pending-withdrawals list with cancel.
- `docs/DATA_MODEL.md`, `docs/API.md`, `docs/ASSUMPTIONS.md` (#7 rewritten to record the reversal, new #8), `docs/DEPLOYMENT.md`, `README.md` — updated to match.

**What changed and why**: Cycle 2's tiered/subscription model was a reasonable reading of the master prompt's §9/§11 in isolation, but the founder's actual intent was simpler and different: no tiers, no subscriptions — fund a wallet with crypto, trade positions on artists from that balance, withdraw later. Reversing it cleanly (drop, don't deprecate-in-place) keeps the schema honest about what's actually in use, per this project's own standing rule against dead code paths.

**Withdrawals, done honestly**: Coinbase Commerce can accept payments but has no API to send crypto out. Rather than fake a "withdraw" button that does nothing real, `request_withdrawal` genuinely debits the wallet and creates a real, trackable `pending` request; turning that into an actual crypto transfer is a manual step (documented in `docs/DEPLOYMENT.md`), not a missing feature dressed up as done.

**Verified**: security advisor clean after both migrations (no repeat of the Cycle 1 `SECURITY DEFINER` exposure near-miss — the explicit `revoke ... from anon, authenticated, public` pattern has now held on the first try twice in a row). Confirmed via direct REST calls: `support_tiers` now 404s (table gone), `withdrawal_requests` correctly hidden from anon by RLS, `request_withdrawal` RPC correctly rejects anon callers, `feature_flags.regulated_offerings` still `false`.

**Remaining limitations**: same deployment blocker as every prior cycle (Edge Functions not deployed, no Coinbase Commerce credentials configured) — now seven functions waiting on that. `regulated_offerings` is still off, which means **there is currently no visible way to back an artist on the live UI at all** — the only backing mechanism that exists (trading) is gated behind a flag the founder hasn't turned on. That's not an oversight to fix by flipping it; per `docs/DEPLOYMENT.md` it's a deliberate legal/jurisdiction go/no-go the founder should make explicitly. Worth flagging directly rather than leaving implicit.

**Recommended next slice**: decide on the `regulated_offerings` flag (turn it on to make backing visible, or explicitly keep it off while other product surfaces get built first) — this determines whether the next slice is "polish the now-visible trading UI" or "build something else while backing stays dark."

---

## Cycle 2 — Default tiered "Back Artist" flow

**Slice**: Cycle 1's recommended next step — a working default support mechanism for artist pages, since `regulatedOfferings` being gated off left every visitor with no way to back an artist at all.

**Files changed**:

- `artist.html` — `renderBackingPanel` is now a dispatcher: `renderTierPanel` (default) renders real tier cards, checkout, current-subscription status, and cancel; `renderTradingPanel` (the pre-existing bonding-curve UI, renamed) still only renders when `regulated_offerings` is on.
- `supabase/functions/support-artist/` — new Edge Function, same JWT-verify-then-service-role pattern as every other write path in this project.
- `supabase/functions/coinbase-webhook/index.ts` — added a third charge-lookup branch (`support_payments`) alongside the existing two.
- `docs/DATA_MODEL.md`, `docs/API.md`, `docs/ASSUMPTIONS.md` (#7, #8), `README.md` — updated to match.

**Database migrations**: `default_support_flow` (`support_tiers`, `support_subscriptions`, `support_payments`), `seed_support_tiers` (3 tiers × 5 artists), `record_support_payment_confirmed_function` (the atomic create-or-renew RPC the webhook calls).

**What changed and why**: artist pages now have a real, working default backing mechanism again — pick a tier, pay via Coinbase Commerce, get a `support_subscriptions` row once the webhook confirms. Benefits are a plain array on the tier rather than a separate `Benefit`/`BenefitEntitlement` table (§19) — no gated content exists yet to need per-benefit tracking; see `docs/ASSUMPTIONS.md` #7 for the reasoning and the migration path if that stops being true. "Monthly" tiers track a period but do not auto-charge — Coinbase Commerce has no stored-payment-method mechanism, so real recurring billing isn't possible with the current payment provider (§8).

**Verified**: every migration checked against the security advisor (clean — the explicit `revoke ... from anon, authenticated, public` pattern from Cycle 1 held up on the first try this time, no repeat of that near-miss). Data paths verified via direct REST calls against the anon key (tier list matches exactly what the UI queries for; `support_subscriptions`/`support_payments` correctly return empty to anon). Browser-based end-to-end testing was attempted but blocked by proxy flakiness in this sandbox (consistent with earlier in this session) — code review + syntax checks + REST verification stood in for it, same as prior cycles when this happened.

**Remaining limitations**:

- No renew prompt/reminder when a monthly subscription's `current_period_end` has passed — it just goes stale silently. Flagged, not hidden.
- Edge Functions (now five of them) are still not deployed — blocked on tool approval, unchanged across every cycle so far.
- No way to browse/compare tiers across artists, no artist-side tier management UI (tiers are seeded via SQL, same as the artist roster itself).
- A user can only back one tier per artist at a time (`unique(user_id, artist_id)`) — switching tiers replaces the old subscription rather than stacking. Not explicitly surfaced in the UI copy yet.

**Recommended next slice**: either (a) the framework decision flagged in Cycle 1 (needed before Phase 2 Discovery can build role-gated, componentized UI at any real scale), or (b) `ArtistFollow`/`ArtistSave` — small, self-contained, and the most natural next piece of the Phase 2 discovery loop given Phase 1/1.5 are now both genuinely done.

---

## Cycle 1 — Phase 1 Foundation: RBAC, feature flags, docs, `regulatedOfferings` gating

**Slice**: Inspect the repo, produce the required assessment docs, then implement the highest-priority piece of Phase 1 Foundation that was still missing — role-based access control and the feature-flag mechanism needed to correctly scope the trading system that predates this master prompt.

**Files changed**:

- `docs/ARCHITECTURE.md`, `docs/PRODUCT_SPEC.md`, `docs/ASSUMPTIONS.md`, `docs/DATA_MODEL.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md` — new.
- `.env.example` — new.
- Supabase migrations: `rbac_foundation`, `harden_rbac_function_exposure` (schema below).
- `artist.html`, `css/styles.css` — Buy/Sell trading panel now conditionally rendered behind the `regulated_offerings` feature flag; rebuilt to call the real `trade`/`close-position`/`deposit` Edge Functions instead of the dead `create-charge(kind:'backing')` path (which broke when `backings` was dropped and `create-charge` was simplified to song-only, both earlier this session).

**Database migrations**:

- `rbac_foundation`: `profiles`, `user_roles`, `artist_members`, `feature_flags` (seeded `regulated_offerings=false`), `jurisdiction_rules`, `artists.claimed_by_user_id`, `handle_new_user` trigger on `auth.users`, `has_role()` helper.
- `harden_rbac_function_exposure`: moved `has_role` to a `private` schema (not PostgREST-exposed) and locked `handle_new_user`'s EXECUTE grant down — see `docs/SECURITY.md` for why.

**What changed and why**: The master prompt classifies the continuous bonding-curve Buy/Sell system (built earlier this session in response to a separate, explicit user request) as a `regulatedOfferings` module that must be disabled by default. That system existed with no gate at all before this cycle — any signed-in user landing on an artist page saw a live trading panel. It's now behind `feature_flags.regulated_offerings` (default `false`); with the flag off, the page shows an honest "backing isn't open yet" message instead of dead/fake trading UI, per the prompt's own §1.9–1.10. Flipping the flag on renders the real trading UI, now correctly wired to the `trade`/`deposit`/`close-position` Edge Functions (previously the frontend still called a now-nonexistent charge kind — this cycle also fixed that regression).

**Environment variables**: none new. `.env.example` added documenting existing Coinbase Commerce secrets that were already required but previously undocumented.

**Remaining limitations**:

- Edge Functions (`trade`, `close-position`, `deposit`, updated `coinbase-webhook`, `create-charge`) are still not deployed — blocked on tool approval, unchanged from before this cycle.
- No admin UI exists to grant `user_roles`/`artist_members` — currently requires direct DB access.
- The default tiered "Back Artist" flow (§9/§11) still does not exist — `regulatedOfferings` being gated off means artist pages currently show _no_ backing mechanism to ordinary users until either the flag is turned on (not recommended without legal review) or the default flow is built.
- No light/dark theme toggle, no §5 visual identity, no design tokens beyond the existing CSS custom properties.
- No tests, no CI, no rate limiting, no audit log.

**Recommended next slice**: build the default tiered "Back Artist" flow (`support_tiers`, `support_subscriptions`, `benefit_entitlements`) so artist pages have a working, visible support mechanism again — this is higher priority than any Phase 2 discovery work, since it's the product's core action and is currently a gap for every visitor.

---

## Session history predating this log (for context)

Summarized from conversation history, not re-verified line-by-line in this cycle:

1. Repo created, landing page built (single-file static HTML).
2. Supabase backend added: artists/tracks/waitlist, song ownership, artist profile pages. (One notable incident: an early Supabase project reuse mistake — briefly wrote Nextup migrations to the org's _other_, unrelated Supabase project before catching it, reverting, and creating the correct dedicated `nextup` project. See project history if relevant.)
3. Global/crypto-only repositioning (removed region-specific framing, switched all payments to Coinbase Commerce).
4. Scroll-jank and mobile-header bugs found and fixed via real phone-width testing.
5. Prettier adopted repo-wide; dead CSS removed during a proofreading pass.
6. Bonding-curve Buy/Sell trading system built (this is the `regulatedOfferings` module referenced above) in response to a specific request to replicate a prediction-market product's mechanics — built _before_ this master prompt existed, which is why Cycle 1 above spent its budget reconciling rather than building it fresh.

# NextUp — Architecture & Implementation Assessment

Written at the start of the "master prompt" implementation pass (see `docs/IMPLEMENTATION_LOG.md` for the running log). This is the inspection required before touching code: what exists, what's missing, and the sequence for closing the gap.

## Current stack (as of this assessment)

- **Frontend**: React 18 + Vite + `react-router-dom`, a client-side-routed single-page app (Cycle 6 — see `docs/ASSUMPTIONS.md` #2). One route per topic: `/`, `/how-it-works`, `/pricing`, `/discover`, `/about`, `/faq`, `/press`, `/terms`, `/risk-disclosure`, `/privacy`, `/artist/:slug`, plus the signed-in surfaces `/account`, `/apply`, `/dashboard` (artist-team members) and `/admin` (admins only). Shared chrome (`Header`, `Footer`, `AuthWidget`, `SessionContext`) lives under `src/components`/`src/context`; pages under `src/pages`. Styling is still the single hand-written `css/styles.css` (custom properties, no design-token build pipeline, no CSS-in-JS) — the migration ported the existing visual design as-is rather than bundling in the still-deferred §5 redesign.
- **Backend**: Supabase (Postgres + Auth + Edge Functions). Project `nextup` (ref `djnsjtlkjgjqmfcucjqp`), separate from the unrelated "Unbeatable" project in the same org.
- **Auth**: Supabase email magic-link (OTP). No passwords, no social sign-in, no roles beyond "signed in / not signed in."
- **Payments**: Coinbase Commerce (hosted checkout) is the only payment method — crypto-only, no cards. Two flows exist: (1) direct song-ownership purchase, (2) wallet deposit that funds an internal trading balance.
- **Hosting**: not deployed anywhere yet. Domain `nextup.exchange` is acquired but unconnected. `npm run build` now produces a static `dist/` bundle — there's a build step where there wasn't one before, see `docs/DEPLOYMENT.md`.
- **Tooling**: Prettier, Vite. No linter (no ESLint config yet — a real gap now that JSX exists), no type checker, no test runner, no CI.

## Existing functionality

- Landing page: hero, how-it-works, pricing copy, live artist roster (reads from `artists`), about, FAQ, press contact, waitlist capture — split across dedicated routes rather than tiers/anchors (Cycle 5).
- Artist profile page (`/artist/:slug`): bio, track list, song-ownership purchase (Coinbase-backed), and a Buy/Sell trading panel on a per-artist bonding-curve price (see below).
- Magic-link auth widget, shared across pages.
- Waitlist capture (`waitlist_signups`, public insert).
- Song ownership: flat-price per track, one owner per track, paid via Coinbase Commerce hosted checkout, recorded server-side only after webhook confirmation.
- **Bonding-curve trading engine** (built this session, pre-dating the master prompt): `artist_curves` (per-artist continuous price curve, `price(s) = base_price_cents * exp(k*s)`), `wallets` (off-chain balance funded by crypto deposit), `wallet_deposits`, `positions` (Buy="positive"/Sell="negative", escrow-backed shorts, no margin calls). Two Postgres `SECURITY DEFINER` functions (`open_position`, `close_position`) do the curve math atomically under row locks; two Edge Functions (`trade`, `close-position`) front them after verifying the caller's JWT. This is exactly what the master prompt's §11 describes as the `regulatedOfferings` module — see `docs/ASSUMPTIONS.md` for how it's being reclassified.

## Missing functionality (relative to the master prompt)

Nearly everything outside "discover an artist, back them with a simple flow, buy a song" is missing:

- **Roles/RBAC**: ~~no `profiles`, no role table, no listener/supporter/artist/artist-team/admin/curator distinction at all — every signed-in user is identical~~ **built (Cycles 4, 8, 9, 13)** — `profiles`, `user_roles`, `artist_members`, `private.has_role()`, role chips on `/account`, and two role-gated surfaces (`/dashboard` for artist teams, `/admin` for admins). Still missing: any UI for granting `user_roles` (deliberate, see below) and curator-specific surfaces (the role exists and reads applications, but nothing is built for it to do yet).
- **Default support flow**: no tiered one-time/recurring "Back Artist" flow with `SupportTier`/`SupportSubscription`/`SupportPayment`/`BenefitEntitlement` — this was replaced by the bonding-curve system mid-session and needs to be reintroduced as the _default_, with trading demoted to an opt-in module (§11).
- **NextUp Credits / ledger**: no double-entry ledger, no promotional credits, no reconciliation.
- **Marketplace/drops**: no products, variants, inventory, orders.
- **Community**: no posts, comments, reactions, polls.
- **Artist dashboard**: analytics + profile editing built (Cycle 9); artist onboarding/application built (Cycle 12, `/apply`). Still missing: content publishing and team management.
- **A&R pipeline**: no leads, pipeline stages, kanban.
- **Admin**: application review queue, artist onboarding, feature-flag toggles and an audit log built (Cycle 13, `/admin`). Still missing: moderation (nothing user-generated exists to moderate yet), a role-grant UI (deliberately SQL-only — see `docs/SECURITY.md`), a withdrawal-fulfillment queue, and jurisdiction-rule enforcement (`jurisdiction_rules` is still a stub nothing reads).
- **Momentum engine**: ~~`stat_30d_pct` on `artists` is a single static seeded number~~ **built (Cycle 7)** — `artist_momentum_daily` holds historized daily scores computed by pg_cron exclusively from real activity (follows, trades, purchases), with the component breakdown stored and shown in the UI. The seeded `stat_30d_pct` is no longer displayed anywhere. What's still missing versus the full spec: richer input signals (there are no streaming/show-attendance integrations to draw from yet) and trend-over-time visualization.
- **Notifications, analytics events, testing, CI**: none exist.
- **Design system**: no light/dark theme toggle (site is dark-only), no formalized token set matching §5's visual identity brief, no Nintendo-cartridge-style artist cards.
- **Docs**: none existed before this pass.

## Architectural risks

0. **The bonding curve has no reserve behind it — money is destroyed on open and conjured on close.** This is the most serious finding in the project to date, and it was invisible until Cycle 16 built the ledger that could see it. `open_position` does `balance_cents - p_stake_cents`; the stake leaves the wallet and is written nowhere. `close_position` does `balance_cents + v_proceeds`; the proceeds are credited from nothing. The arithmetic is internally consistent — no row is wrong, no constraint is violated, nothing throws — so no amount of reading the trading code reveals it. What reveals it is asking a second, independent record whether obligations are covered, which is the entire reason the ledger exists.

   Proven end to end: a $100 deposit is fully covered (obligations 10000, holdings 10000, coverage 0). One $20 stake closed at a profit pays out 2984 cents, leaving obligations at 10984 against holdings of 10000 — **coverage −984**. A single ordinary trade, using the product exactly as intended, created a $9.84 liability with nothing behind it. The ledger still sums to zero, because the entries are honest about where the money came from; it came from an account nobody funded.

   **This reframes board point 7 entirely.** The concern raised was "there is no treasury table." The accurate statement is that **the Backing product has no funding model**: nothing defines where a winning payout is funded from, what the company's maximum exposure is, or what happens when obligations exceed holdings. That is a commercial and regulatory question, not an engineering one, and it is the same question the classification decision asks from the other side. Engineering can enforce a reserve; it cannot decide how big it is. **`regulated_offerings` must not carry real customer money until that decision is made.** Deposits, withdrawals and track purchases are unaffected — they reconcile cleanly.

0a. **~~No customer-funds segregation, no ledger.~~ Addressed — Cycle 16.** Raised in board review (31 July 2026). `ledger_accounts`/`ledger_transactions`/`ledger_entries` now sit underneath the money tables, with company and customer account kinds that cannot be commingled (partial unique indexes, not convention), a deferrable constraint trigger that refuses any transaction not summing to zero, and continuous reconciliation between `wallets.balance_cents` and the ledger's view of the same wallet. `admin_reconcile_wallets()` was verified against a deliberately-introduced 777-cent silent wallet edit and reported it with the exact drift. What remains open is not the accounting but the policy above: **how much capital stands behind the product**. Custody model (Decision 3) is still unanswered and still gates real money.

0b. **"Own the Song" is not legally defined.** The product sells "permanent ownership of a track" and the Terms deliberately say only that ownership "is recorded to your account". Whether that conveys copyright, master rights, a licence, collectable status, resale rights or royalty participation is undetermined — and it drives the consumer proposition, tax treatment, accounting treatment and regulatory exposure. There is also no resale mechanism, so "ownership" is currently non-transferable by omission rather than by decision.

1. **~~Static HTML/vanilla-JS will not scale to this spec.~~ Resolved — Cycle 6.** Role-gated dashboards, a kanban A&R board, community feeds with nested comments, and an admin console are qualitatively different from a five-section marketing site. Continuing to hand-write `innerHTML` template strings past Phase 2 would have produced unmaintainable, bug-prone code. Founder confirmed the framework decision explicitly (not made silently) and the site is now React + Vite (see `docs/ASSUMPTIONS.md` #2's update) — this risk no longer blocks Phase 2+.
2. **`regulatedOfferings` was built before the default support flow existed.** Session history built the trading/backing mechanic first (in response to an explicit user request to copy a prediction-market product), then received this master prompt, which classifies that exact mechanic as a disabled-by-default regulated module and wants a separate simple tiered flow as default. Resolved in this pass by adding a feature flag and gating the trading UI behind it; the simple tiered flow is queued as the next slice, not yet built.
3. **RLS-aware role model** — originally every table's RLS was keyed only on `auth.uid()` (row ownership). Role-aware policies now exist where role-gated surfaces exist: `user_roles`/`artist_members` reads use `private.has_role()` (Cycle 4), and Cycle 9 added the first role-gated **write** — artist profile editing restricted to team members with editing roles, combined with column-level grants so even editors can't touch structural/financial columns. Cycle 13 settled the admin question without adding admin write _policies_ at all: the console's writes go through `SECURITY DEFINER` functions that check `private.has_role(auth.uid(),'admin')` internally, so `artist_applications`, `feature_flags`, `artists`, `artist_members` and `audit_log` keep zero client-writable policies. An admin-wide `USING (has_role(...))` UPDATE policy would have been the obvious move and a worse one — it would let an admin's browser write any column of those tables directly, instead of only the specific transitions the functions perform.
4. **Single Supabase project, single environment** — no staging/prod split, no migration rollback tooling beyond Supabase's own history. Acceptable at this stage; flagged for `docs/DEPLOYMENT.md`.
5. **Edge Functions written but deployment is blocked** — the `deploy_edge_function` tool call has required manual approval in this session and hasn't been granted. `trade`, `close-position`, `deposit`, and the updated `coinbase-webhook` are committed as source but not live. Real Coinbase Commerce credentials also aren't configured. Both are outside this agent's ability to resolve unilaterally.

## Database changes (this pass)

See `docs/DATA_MODEL.md` for the full current schema. This pass adds: `profiles`, `user_roles`, `artist_members`, `feature_flags`, `jurisdiction_rules`.

## API changes (this pass)

No new Edge Functions this pass — RBAC is enforced via RLS policies directly, which is sufficient until role-gated _write_ endpoints (admin actions, A&R pipeline writes) exist.

## UI components (this pass)

- Light/dark theme token pass is deferred (see Assumptions) — no visual redesign in this pass, to keep the RBAC/schema slice reviewable on its own.
- Trading UI (Buy/Sell panel on the Artist page/`/artist/:slug` route) is conditionally rendered based on the `regulated_offerings` feature flag (`BackingPanel`/`TradingPanel` components).

## Security requirements (this pass)

- All new tables ship with RLS enabled from creation (no table is ever created open).
- Role tables are readable by their own user only, plus admins; writable by nobody from the client (role grants happen server-side/manually until an admin UI exists — recorded as a follow-up).
- Continuing the pattern already established for `open_position`/`close_position`: any future `SECURITY DEFINER` function must have its `EXECUTE` grant explicitly checked with the security advisor after creation — this session already caught and fixed one case where `REVOKE ALL FROM PUBLIC` silently failed to block `anon`/`authenticated` (Supabase grants those roles `EXECUTE` directly, independent of `PUBLIC`).

## Implementation sequence

Following the master prompt's own phase order (§28), adapted to what already exists:

1. **Phase 1 — Foundation** _(Cycle 4)_: RBAC schema, feature flags, jurisdiction-rule stub, docs. Design tokens/themes explicitly deferred (see Assumptions).
   - ~~Phase 1.5 — Restore default support flow~~ **dropped**: this line described reintroducing `support_tiers`/`support_subscriptions`/`benefit_entitlements` per the master prompt's §9/§11 default-flow spec. The founder explicitly overrode that direction in Cycle 3 ("we're not doing subs we're doing deposit and withdraws") before this line was corrected — see `docs/ASSUMPTIONS.md` #7. Deposit/withdraw funding the bonding-curve trading system is the permanent backing flow, not a placeholder for tiers to replace later.
2. **Phase 1.6 — Framework migration** _(Cycle 6)_: React + Vite port of the existing site, 1:1 functional parity, no visual redesign. Unblocks Phase 2's componentized/role-gated UI. See `docs/ASSUMPTIONS.md` #2's update.
3. **Phase 2 — Discovery vertical slice** _(Cycle 7)_: follows (`artist_follows` + trigger-maintained public counts), search/filter/sort on the Discover roster, and the historized momentum engine (`artist_momentum_daily`, computed daily by pg_cron from real activity only, breakdown shown in the UI). Fabricated `stat_30d_pct` removed from every data surface.
4. **Phase 2.5 — Account & role surface** _(Cycle 8)_: `/account` page — editable display name (`profiles`), derived role display (Listener always; Supporter derived from real holdings per the spec, never stored; granted `user_roles` and `artist_members` team roles as chips), following grid, wallet balance with withdrawal cancel, open positions across artists, owned songs. Header shows Account when signed in. Gated admin/curator/artist-team _routes_ still don't exist — deliberately, since their surfaces (admin console, artist dashboard) are later phases and empty gated routes would be dead navigation.
5. **Phase 4 — Artist operations** _(Cycle 9, first part)_: `/dashboard` — the first role-gated surface. Artist selector for multi-team users, real analytics tiles (followers, momentum + weekly component summary, live curve price, songs sold + gross at list price), day-by-day momentum history with deltas, and a profile editor (name/tagline/genre/city/bio) gated to owner/manager/content_editor both in UI and by the DB policy above. Artist onboarding/verification deferred — memberships are granted manually pre-launch (`docs/ASSUMPTIONS.md` #10).
6. **Phase 4 (rest) — Artist onboarding** _(Cycle 12)_: `/apply` and `artist_applications` — a real row with a real state machine, following the `withdrawal_requests` pattern rather than waiting on the admin console. See `docs/ASSUMPTIONS.md` #10's update for why the earlier deferral was wrong.
7. **Phase 6 — Internal platform** _(Cycle 13)_: `/admin`, the second role-gated surface and the first that gates on a granted platform role rather than team membership. Application review queue (status + notes, filtered by what needs a decision), one-press artist onboarding that creates the artist, its curve, and the applicant's `owner` membership in a single transaction, feature-flag toggles, and an audit log every admin action writes to. Five `SECURITY DEFINER` functions that derive the actor from `auth.uid()` instead of taking a `user_id` — a different grant shape from the money functions, explained in `docs/SECURITY.md`. Role grants stay SQL-only on purpose; moderation and jurisdiction enforcement remain unbuilt because neither has anything to act on yet.
8. **Withdrawal fulfillment** _(Cycle 14)_ and **rate limiting** _(Cycle 15)_: the payout queue moved out of the SQL editor into an audited console action, and fixed-window limits landed on the tables (not the Edge Functions) that money and signups flow through. See `docs/SECURITY.md` for what per-IP limiting genuinely buys.
9. **Phase 7 — Treasury and double-entry ledger** _(Cycle 16)_: `ledger_accounts`/`ledger_transactions`/`ledger_entries`, posted by triggers on the tables that already move money, balanced by a deferrable constraint trigger, reconciled against `wallets` continuously, and surfaced as the first section of `/admin`. Built in response to board point 7. Its first act was to find risk 0 above.
10. Remaining master-prompt phases, otherwise unchanged: Support vertical slice (already satisfied by the existing deposit/withdraw + bonding-curve flow, not a new build), Community and commerce, moderation/A&R/jurisdiction enforcement — all still **not built**, see "Missing functionality" above.

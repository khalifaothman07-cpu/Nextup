# NextUp — Architecture & Implementation Assessment

Written at the start of the "master prompt" implementation pass (see `docs/IMPLEMENTATION_LOG.md` for the running log). This is the inspection required before touching code: what exists, what's missing, and the sequence for closing the gap.

## Current stack (as of this assessment)

- **Frontend**: React 18 + Vite + `react-router-dom`, a client-side-routed single-page app (Cycle 6 — see `docs/ASSUMPTIONS.md` #2). One route per topic: `/`, `/how-it-works`, `/pricing`, `/discover`, `/about`, `/faq`, `/press`, `/terms`, `/risk-disclosure`, `/privacy`, `/artist/:slug`. Shared chrome (`Header`, `Footer`, `AuthWidget`, `SessionContext`) lives under `src/components`/`src/context`; pages under `src/pages`. Styling is still the single hand-written `css/styles.css` (custom properties, no design-token build pipeline, no CSS-in-JS) — the migration ported the existing visual design as-is rather than bundling in the still-deferred §5 redesign.
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

- **Roles/RBAC**: no `profiles`, no role table, no listener/supporter/artist/artist-team/admin/curator distinction at all. Every signed-in user is identical.
- **Default support flow**: no tiered one-time/recurring "Back Artist" flow with `SupportTier`/`SupportSubscription`/`SupportPayment`/`BenefitEntitlement` — this was replaced by the bonding-curve system mid-session and needs to be reintroduced as the _default_, with trading demoted to an opt-in module (§11).
- **NextUp Credits / ledger**: no double-entry ledger, no promotional credits, no reconciliation.
- **Marketplace/drops**: no products, variants, inventory, orders.
- **Community**: no posts, comments, reactions, polls.
- **Artist dashboard**: no artist-facing analytics, content publishing, or team management.
- **A&R pipeline**: no leads, pipeline stages, kanban.
- **Admin**: no moderation, audit log, feature-flag UI, jurisdiction rules.
- **Momentum engine**: ~~`stat_30d_pct` on `artists` is a single static seeded number~~ **built (Cycle 7)** — `artist_momentum_daily` holds historized daily scores computed by pg_cron exclusively from real activity (follows, trades, purchases), with the component breakdown stored and shown in the UI. The seeded `stat_30d_pct` is no longer displayed anywhere. What's still missing versus the full spec: richer input signals (there are no streaming/show-attendance integrations to draw from yet) and trend-over-time visualization.
- **Notifications, analytics events, testing, CI**: none exist.
- **Design system**: no light/dark theme toggle (site is dark-only), no formalized token set matching §5's visual identity brief, no Nintendo-cartridge-style artist cards.
- **Docs**: none existed before this pass.

## Architectural risks

1. **~~Static HTML/vanilla-JS will not scale to this spec.~~ Resolved — Cycle 6.** Role-gated dashboards, a kanban A&R board, community feeds with nested comments, and an admin console are qualitatively different from a five-section marketing site. Continuing to hand-write `innerHTML` template strings past Phase 2 would have produced unmaintainable, bug-prone code. Founder confirmed the framework decision explicitly (not made silently) and the site is now React + Vite (see `docs/ASSUMPTIONS.md` #2's update) — this risk no longer blocks Phase 2+.
2. **`regulatedOfferings` was built before the default support flow existed.** Session history built the trading/backing mechanic first (in response to an explicit user request to copy a prediction-market product), then received this master prompt, which classifies that exact mechanic as a disabled-by-default regulated module and wants a separate simple tiered flow as default. Resolved in this pass by adding a feature flag and gating the trading UI behind it; the simple tiered flow is queued as the next slice, not yet built.
3. **RLS-aware role model** — originally every table's RLS was keyed only on `auth.uid()` (row ownership). Role-aware policies now exist where role-gated surfaces exist: `user_roles`/`artist_members` reads use `private.has_role()` (Cycle 4), and Cycle 9 added the first role-gated **write** — artist profile editing restricted to team members with editing roles, combined with column-level grants so even editors can't touch structural/financial columns. Admin/curator write policies still need designing before Phase 6's admin console.
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
6. Phases 3–7 per the master prompt, otherwise unchanged: Support vertical slice (already satisfied by the existing deposit/withdraw + bonding-curve flow, not a new build), Artist operations, Community and commerce, Internal platform (admin/moderation/A&R/audit/flags/jurisdiction), NextUp Credits (ledger) — all still **not built**, see "Missing functionality" above.

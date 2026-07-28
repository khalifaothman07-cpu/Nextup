# NextUp — Architecture & Implementation Assessment

Written at the start of the "master prompt" implementation pass (see `docs/IMPLEMENTATION_LOG.md` for the running log). This is the inspection required before touching code: what exists, what's missing, and the sequence for closing the gap.

## Current stack (as of this assessment)

- **Frontend**: static multi-page HTML (`index.html`, `artist.html`) + vanilla JS ES modules (`js/app.js`, `js/supabase-client.js`). No build step, no framework, no router. Styling is a single hand-written `css/styles.css` (custom properties, no design-token build pipeline).
- **Backend**: Supabase (Postgres + Auth + Edge Functions). Project `nextup` (ref `djnsjtlkjgjqmfcucjqp`), separate from the unrelated "Unbeatable" project in the same org.
- **Auth**: Supabase email magic-link (OTP). No passwords, no social sign-in, no roles beyond "signed in / not signed in."
- **Payments**: Coinbase Commerce (hosted checkout) is the only payment method — crypto-only, no cards. Two flows exist: (1) direct song-ownership purchase, (2) wallet deposit that funds an internal trading balance.
- **Hosting**: not deployed anywhere yet. Domain `nextup.exchange` is acquired but unconnected.
- **Tooling**: Prettier only. No linter, no type checker, no test runner, no CI.

## Existing functionality

- Landing page: hero, how-it-works, pricing/tiers copy, live artist roster (reads from `artists`), about, FAQ, press contact, waitlist capture.
- Artist profile page (`artist.html?slug=`): bio, track list, song-ownership purchase (Coinbase-backed), and a Buy/Sell trading panel on a per-artist bonding-curve price (see below).
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
- **Momentum engine**: `stat_30d_pct` on `artists` is a single static seeded number, not a computed, historized, explainable score.
- **Notifications, analytics events, testing, CI**: none exist.
- **Design system**: no light/dark theme toggle (site is dark-only), no formalized token set matching §5's visual identity brief, no Nintendo-cartridge-style artist cards.
- **Docs**: none existed before this pass.

## Architectural risks

1. **Static HTML/vanilla-JS will not scale to this spec.** Role-gated dashboards, a kanban A&R board, community feeds with nested comments, and an admin console are qualitatively different from a five-section marketing site. Continuing to hand-write `innerHTML` template strings past Phase 2 will produce unmaintainable, bug-prone code — this is exactly the kind of "existing architecture materially obstructs the product" case the prompt's §1.8 authorizes a refactor for. **Decision**: keep the current stack for Phase 1 (foundation, still page-shaped), flag introducing a proper frontend framework as a required decision before Phase 2 (Discover) starts building role-gated, componentized UI. Recorded in `docs/ASSUMPTIONS.md`.
2. **`regulatedOfferings` was built before the default support flow existed.** Session history built the trading/backing mechanic first (in response to an explicit user request to copy a prediction-market product), then received this master prompt, which classifies that exact mechanic as a disabled-by-default regulated module and wants a separate simple tiered flow as default. Resolved in this pass by adding a feature flag and gating the trading UI behind it; the simple tiered flow is queued as the next slice, not yet built.
3. **No RLS-aware role model yet** — every table's RLS today is keyed only on `auth.uid()` (row ownership), never on role. Admin/curator/artist-team access control needs to be designed before any admin or A&R feature is safe to build.
4. **Single Supabase project, single environment** — no staging/prod split, no migration rollback tooling beyond Supabase's own history. Acceptable at this stage; flagged for `docs/DEPLOYMENT.md`.
5. **Edge Functions written but deployment is blocked** — the `deploy_edge_function` tool call has required manual approval in this session and hasn't been granted. `trade`, `close-position`, `deposit`, and the updated `coinbase-webhook` are committed as source but not live. Real Coinbase Commerce credentials also aren't configured. Both are outside this agent's ability to resolve unilaterally.

## Database changes (this pass)

See `docs/DATA_MODEL.md` for the full current schema. This pass adds: `profiles`, `user_roles`, `artist_members`, `feature_flags`, `jurisdiction_rules`.

## API changes (this pass)

No new Edge Functions this pass — RBAC is enforced via RLS policies directly, which is sufficient until role-gated _write_ endpoints (admin actions, A&R pipeline writes) exist.

## UI components (this pass)

- Light/dark theme token pass is deferred (see Assumptions) — no visual redesign in this pass, to keep the RBAC/schema slice reviewable on its own.
- Trading UI (Buy/Sell panel on `artist.html`) is now conditionally rendered based on the `regulated_offerings` feature flag, defaulting to hidden.

## Security requirements (this pass)

- All new tables ship with RLS enabled from creation (no table is ever created open).
- Role tables are readable by their own user only, plus admins; writable by nobody from the client (role grants happen server-side/manually until an admin UI exists — recorded as a follow-up).
- Continuing the pattern already established for `open_position`/`close_position`: any future `SECURITY DEFINER` function must have its `EXECUTE` grant explicitly checked with the security advisor after creation — this session already caught and fixed one case where `REVOKE ALL FROM PUBLIC` silently failed to block `anon`/`authenticated` (Supabase grants those roles `EXECUTE` directly, independent of `PUBLIC`).

## Implementation sequence

Following the master prompt's own phase order (§28), adapted to what already exists:

1. **Phase 1 — Foundation** _(this pass)_: RBAC schema, feature flags, jurisdiction-rule stub, docs. Design tokens/themes explicitly deferred (see Assumptions).
2. **Phase 1.5 — Restore default support flow**: `support_tiers`, `support_subscriptions`, `benefit_entitlements`, wired as the default "Back Artist" UI; demote trading module behind the feature flag's UI gate (schema-level gating lands this pass, UI gate lands with this slice).
3. **Phase 2 — Discovery vertical slice**: requires the framework decision from Architectural Risk #1 to be made first.
4. Phases 3–7 per the master prompt, unchanged.

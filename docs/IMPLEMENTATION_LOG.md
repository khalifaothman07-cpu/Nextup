# Implementation Log

Newest entry first. Each entry follows the master prompt's §31 working-cycle format.

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

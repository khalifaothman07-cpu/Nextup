# Implementation Log

Newest entry first. Each entry follows the master prompt's §31 working-cycle format.

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

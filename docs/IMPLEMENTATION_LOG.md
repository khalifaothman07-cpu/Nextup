# Implementation Log

Newest entry first. Each entry follows the master prompt's §31 working-cycle format.

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

# NextUp

> **Taking this project over? Start with [`HANDOVER.md`](HANDOVER.md), not here.**
> It covers what has to change hands, the one unresolved problem that gates real
> money, and why `bash scripts/pull-schema.sh <project-ref>` is the first command
> you should run — the database schema is not in this repository.

An artist discovery, support, and commerce platform — not a generic streaming clone. Full product definition: `docs/PRODUCT_SPEC.md`. Current architecture, what's built vs. missing, and the implementation sequence: `docs/ARCHITECTURE.md`.

**Status: not deployed anywhere.** Domain `nextup.exchange` is acquired but unconnected — nothing goes live without explicit approval.

## What's actually built right now

A React + Vite single-page app (as of Cycle 6 — see `docs/ASSUMPTIONS.md` #2) plus a Supabase backend:

- `src/pages/Home.jsx` (`/`) — landing page: hero, waitlist capture, a live roster teaser, and short teasers linking out to a dedicated page per topic rather than one long scroll.
- `HowItWorks`, `Pricing`, `Discover` (full roster), `About`, `Faq`, `Press` (`/how-it-works`, `/pricing`, `/discover`, `/about`, `/faq`, `/press`) — each topic gets its own real route, not an anchor into `/`.
- `Terms`, `RiskDisclosure`, `Privacy` (`/terms`, `/risk-disclosure`, `/privacy`) — real (pre-launch draft, not yet reviewed by counsel) pages behind the footer's LEGAL links, replacing what were previously dead `#` links.
- `Artist` (`/artist/:slug`) — per-artist profile: bio, track list, song-ownership purchase (crypto checkout via Coinbase Commerce).
- Magic-link auth (no passwords), via `SessionContext`/`AuthWidget`.
- Backing an artist = deposit into your Nextup wallet (crypto, via Coinbase Commerce), then trade Buy/Sell positions on the artist's live bonding-curve price from that balance, and withdraw later (a request, not an instant payout — see `docs/ASSUMPTIONS.md` #8). No tiers, no subscriptions.
- The whole backing/trading system is a feature-flagged `regulatedOfferings` module — ships **disabled by default**, see `docs/ASSUMPTIONS.md` #1 for why and `docs/SECURITY.md` for how it's locked down. It is currently **on**, per explicit founder instruction; with it off, artist pages show an honest "not open yet" message instead of the Buy/Sell panel.
- `Apply` (`/apply`) — artist applications: one real row per account, with its real status visible on return. Reviewed by a person, not an autoresponder.
- `Account` (`/account`) — display name, derived roles, following, wallet balance and withdrawals, open positions, owned songs.
- `Dashboard` (`/dashboard`) — role-gated to artist-team members: real analytics from platform activity, momentum history, and a profile editor gated to owner/manager/content editor.
- `Admin` (`/admin`) — role-gated to admins: the artist-application review queue, one-press artist onboarding, feature-flag toggles, and an audit log of every admin action. Granting the `admin` role itself is deliberately SQL-only — see `docs/DEPLOYMENT.md` for how to grant the first one.
- RBAC (`profiles`, `user_roles`, `artist_members`, `feature_flags`) — real, and enforced in RLS policies and role-gated routes rather than schema-only.

Everything else in the product spec (marketplace, community, A&R pipeline, moderation, ledger/credits) is **not built** — see `docs/ARCHITECTURE.md`'s "Missing functionality" section rather than assuming partial/hidden implementations exist.

## Install / run locally

```
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`). `npm run build` produces a static `dist/` bundle deployable to any static host; `npm run preview` serves that build locally. Because this is a client-side-routed SPA, any static host needs a history-API fallback (rewrite all paths to `index.html`) — a Netlify-style `public/_redirects` is included; other hosts need their own equivalent (see `docs/DEPLOYMENT.md`).

## Configure

Copy `.env.example` for the list of secrets. In practice: the Supabase URL/publishable key are hardcoded in `src/lib/supabaseClient.js` (no env injection wired up yet, even though a build step now exists — see `docs/ASSUMPTIONS.md` #2's update); the Coinbase Commerce secrets (`COMMERCE_API_KEY`, `COMMERCE_WEBHOOK_SECRET`) are set via `supabase secrets set` against the `nextup` project and are **not currently set** — see `docs/DEPLOYMENT.md`.

## Database schema

**Not in this repository.** It lives in the Supabase project's migration history.
`bash scripts/pull-schema.sh <project-ref>` writes it into `supabase/migrations/`
— do that before anything else. See `HANDOVER.md` §1.

## Seed data

The artist roster (5 fictional artists, 3 tracks each) is seeded directly via SQL migration, not a script — see the migration history in the `nextup` Supabase project. All seed artists are explicitly fictional/placeholder.

## Test

No automated test suite exists yet (see `docs/SECURITY.md`'s "Known gaps"). Format before every commit:

```
npm run format         # npx prettier --write .
npm run format:check   # check only, for CI
```

### Look at the screens before claiming they work

```
npm run build
npm run preview -- --port 8200 --strictPort &
npm run shots          # writes full-page screenshots, then open them
```

`npm run shots` renders the real production build in headless Chromium, including the role-gated pages (`/account`, `/apply`, `/dashboard`, `/admin`) that a static preview can't reach — it fakes a Supabase session and fulfils `/rest/v1/*` with realistically-shaped rows, so you're looking at the actual React code. A passing build says nothing about whether a screen is right: the first run of this caught four already-committed defects (money rounded to whole dollars so a $47.50 balance read "$48", a role label rendering as "content&editor", "1 songs purchased", and marketing-page spacing on tool pages). Treat it as part of finishing a UI change, not an optional extra.

## Feature flags

`regulated_offerings` (in the `feature_flags` table) gates the entire Buy/Sell trading UI — **currently `true`**, per explicit founder instruction (legal/jurisdiction ownership confirmed on their end). See `docs/DEPLOYMENT.md`.

## Docs

- `docs/PRODUCT_SPEC.md` — what NextUp is, terminology rules, roles, visual identity.
- `docs/ARCHITECTURE.md` — inspection/assessment, architectural risks, implementation sequence.
- `docs/DATA_MODEL.md` — the real deployed schema.
- `docs/API.md` — Edge Functions.
- `docs/SECURITY.md` — the trust model, and two documented near-misses (mirror images of each other) worth reading before writing any new `SECURITY DEFINER` function, plus why the admin functions are granted to `authenticated` when the money functions are not.
- `docs/ASSUMPTIONS.md` — recorded assumptions and why.
- `docs/IMPLEMENTATION_LOG.md` — running log, newest first.
- `docs/DEPLOYMENT.md` — what deploying would involve (nothing is deployed yet).
- `HANDOVER.md` — transfer notes: accounts to move, what is and isn't deployed, the decisions that were never made, and the traps.

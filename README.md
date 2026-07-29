# NextUp

An artist discovery, support, and commerce platform — not a generic streaming clone. Full product definition: `docs/PRODUCT_SPEC.md`. Current architecture, what's built vs. missing, and the implementation sequence: `docs/ARCHITECTURE.md`.

**Status: not deployed anywhere.** Domain `nextup.exchange` is acquired but unconnected — nothing goes live without explicit approval.

## What's actually built right now

A static two-page site (`index.html`, `artist.html`) plus a Supabase backend:

- Landing page: roster, pricing/tiers copy, FAQ, waitlist capture.
- Artist profile pages: bio, track list, song-ownership purchase (crypto checkout via Coinbase Commerce).
- Magic-link auth (no passwords).
- Backing an artist = deposit into your Nextup wallet (crypto, via Coinbase Commerce), then trade Buy/Sell positions on the artist's live bonding-curve price from that balance, and withdraw later (a request, not an instant payout — see `docs/ASSUMPTIONS.md` #8). No tiers, no subscriptions.
- The whole backing/trading system is a feature-flagged `regulatedOfferings` module — **disabled by default**, see `docs/ASSUMPTIONS.md` #1 for why and `docs/SECURITY.md` for how it's locked down. With the flag off (current state), artist pages show an honest "not open yet" message instead.
- RBAC foundation (`profiles`, `user_roles`, `artist_members`, `feature_flags`) — schema only; no admin UI to manage it yet.

Everything else in the product spec (marketplace, community, momentum engine, A&R pipeline, admin console, ledger/credits) is **not built** — see `docs/ARCHITECTURE.md`'s "Missing functionality" section rather than assuming partial/hidden implementations exist.

## Install / run locally

No build step. From the repo root:

```
python3 -m http.server 8000
```

Open `http://localhost:8000`. Edits to `index.html`/`artist.html`/`css/styles.css`/`js/*.js` take effect on refresh.

## Configure

Copy `.env.example` for the list of secrets. In practice: the Supabase URL/publishable key are hardcoded in `js/supabase-client.js` (no build step to inject them); the Coinbase Commerce secrets (`COMMERCE_API_KEY`, `COMMERCE_WEBHOOK_SECRET`) are set via `supabase secrets set` against the `nextup` project and are **not currently set** — see `docs/DEPLOYMENT.md`.

## Seed data

The artist roster (5 fictional artists, 3 tracks each) is seeded directly via SQL migration, not a script — see the migration history in the `nextup` Supabase project. All seed artists are explicitly fictional/placeholder.

## Test

No automated test suite exists yet (see `docs/SECURITY.md`'s "Known gaps"). Format before every commit:

```
npm run format         # npx prettier --write .
npm run format:check   # check only, for CI
```

## Feature flags

`regulated_offerings` (in the `feature_flags` table, default `false`) gates the entire Buy/Sell trading UI. See `docs/DEPLOYMENT.md` before ever turning it on — it's a legal/jurisdiction gate, not a config toggle.

## Docs

- `docs/PRODUCT_SPEC.md` — what NextUp is, terminology rules, roles, visual identity.
- `docs/ARCHITECTURE.md` — inspection/assessment, architectural risks, implementation sequence.
- `docs/DATA_MODEL.md` — the real deployed schema.
- `docs/API.md` — Edge Functions.
- `docs/SECURITY.md` — the trust model, and a documented near-miss worth reading before writing any new `SECURITY DEFINER` function.
- `docs/ASSUMPTIONS.md` — recorded assumptions and why.
- `docs/IMPLEMENTATION_LOG.md` — running log, newest first.
- `docs/DEPLOYMENT.md` — what deploying would involve (nothing is deployed yet).

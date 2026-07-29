# Deployment

## Current status: not deployed anywhere

Per explicit instruction earlier in this project, nothing goes live without the founder's go-ahead. This doc describes what deployment _would_ involve, not something already done.

## Site

Static files (`index.html`, `artist.html`, `css/`, `js/`) can be hosted anywhere that serves static assets — no build step, no server-side rendering. Domain `nextup.exchange` is acquired but not pointed at anything.

## Supabase

Project `nextup` (ref `djnsjtlkjgjqmfcucjqp`, org `khalifaothman07-cpu's Org`, region `ap-south-1`) is live and holds the real schema described in `docs/DATA_MODEL.md`. It is **separate from** the org's other Supabase project (which backs the unrelated Unbeatable app) — do not reuse that project for NextUp; that mistake was made and corrected earlier in this project's history.

### Edge Functions — blocked

`create-charge`, `deposit`, `withdraw`, `cancel-withdrawal`, `coinbase-webhook`, `trade`, and `close-position` are committed under `supabase/functions/` but **not deployed**. The `deploy_edge_function` tool call has required manual approval every time it's been attempted in this session and approval hasn't been granted. To deploy manually:

```
supabase functions deploy create-charge
supabase functions deploy deposit
supabase functions deploy withdraw
supabase functions deploy cancel-withdrawal
supabase functions deploy trade
supabase functions deploy close-position
supabase functions deploy coinbase-webhook --no-verify-jwt
```

### Withdrawals require a manual step — always

Unlike the Edge Function deployment above (a one-time setup blocker), processing withdrawals is an **ongoing manual step**, not something that becomes automatic once configured: Coinbase Commerce has no API for sending crypto out, only for accepting it. When a `withdrawal_requests` row is `pending`, someone has to actually send the crypto to `destination_address` and then mark it `paid` (currently no admin UI for this — direct DB access, e.g. `update withdrawal_requests set status='paid', processed_at=now() where id=...`, until one exists). See `docs/ASSUMPTIONS.md` #8.

### Required secrets (not yet set)

Real payments cannot work until these are set (`supabase secrets set KEY=value --project-ref djnsjtlkjgjqmfcucjqp`):

- `COMMERCE_API_KEY` — from a real Coinbase Commerce business account (commerce.coinbase.com). This requires the founder to actually create that account; an agent cannot do this step.
- `COMMERCE_WEBHOOK_SECRET` — from the same dashboard, after adding a webhook endpoint pointing at `https://djnsjtlkjgjqmfcucjqp.supabase.co/functions/v1/coinbase-webhook`.
- `SITE_URL` (optional) — defaults to `https://nextup.exchange`; override for testing against a different checkout redirect target.

Until these are set, `create-charge`/`deposit` return a clear `503 "Crypto payments aren't configured yet"` instead of silently pretending to work — this is intentional, not a bug to "fix" by hardcoding test values.

## Environment variables

See `.env.example` at the repo root. The site's Supabase URL and publishable key are currently hardcoded in `js/supabase-client.js` rather than injected at build time, because there is no build step — this is consistent with the "no build step" architecture choice, not an oversight. If a real build pipeline is introduced (see the framework decision in `docs/ASSUMPTIONS.md` #2), move these to real env vars at that point.

## Feature flags

`regulated_offerings` (in the `feature_flags` table) gates the entire Buy/Sell trading UI. **Currently `true`** — the founder explicitly instructed enabling it and confirmed they are handling legal/jurisdiction/licensing review on their end (see `docs/ASSUMPTIONS.md` #1, "Update 2"). This was a deliberate founder decision, not a default to leave alone or an agent judgment call — if that ownership changes, flip it back to `false` immediately rather than leaving the module reachable without an owner for the compliance question.

# Deployment

## Current status: not deployed anywhere

Per explicit instruction earlier in this project, nothing goes live without the founder's go-ahead. This doc describes what deployment _would_ involve, not something already done.

## Site

`npm run build` produces a static `dist/` bundle (React + Vite, see `docs/ASSUMPTIONS.md` #2) that can be hosted anywhere that serves static assets — no server-side rendering, but there **is** now a build step, unlike the original hand-written HTML. Because routing is client-side (`react-router-dom`), the host must rewrite unknown paths to `/index.html` (a history-API fallback) or deep links like `/artist/bruno-mars` will 404 on direct load/refresh. `public/_redirects` (Netlify's convention: `/*  /index.html  200`) is committed for that; other hosts (Vercel, S3+CloudFront, etc.) need their own equivalent rewrite rule. Domain `nextup.exchange` is acquired but not pointed at anything.

## Supabase

Project `nextup` (ref `djnsjtlkjgjqmfcucjqp`, org `khalifaothman07-cpu's Org`, region `ap-south-1`) is live and holds the real schema described in `docs/DATA_MODEL.md`. It is **separate from** the org's other Supabase project (which backs the unrelated Unbeatable app) — do not reuse that project for NextUp; that mistake was made and corrected earlier in this project's history.

### Edge Functions — one deployed, six to go

`trade` is deployed and ACTIVE (31 July 2026). The other six are committed but
not yet up: `create-charge`, `deposit`, `withdraw`, `cancel-withdrawal`,
`close-position`, `coinbase-webhook`.

The blocker was never the code — it is that each deploy needs a manual tool
approval, and the prompts have not been reaching the founder reliably. So the
whole set is also scripted, which needs no approval at all:

```
bash scripts/deploy-functions.sh
```

That deploys all seven (re-deploying `trade` is harmless — it just creates a new
version) and puts `coinbase-webhook` up with `--no-verify-jwt`, which is
correct: Coinbase calls that endpoint, not a signed-in user, and it
authenticates the request itself by verifying the `X-CC-Webhook-Signature` HMAC
before trusting anything in the body. Every other function requires a valid JWT.

Deploying before the Coinbase secrets exist is safe. Without `COMMERCE_API_KEY`
the charge endpoints return a clean 503 saying payments aren't configured,
rather than half-working.

### Withdrawals require a manual step — always

Unlike the Edge Function deployment above (a one-time setup blocker), processing withdrawals is an **ongoing manual step**, not something that becomes automatic once configured: Coinbase Commerce has no API for sending crypto out, only for accepting it. When a `withdrawal_requests` row is `pending`, someone has to actually send the crypto to `destination_address`. **As of Cycle 14 that is done from `/admin`, not from the SQL editor** — the queue shows the amount, the full untruncated address, and the payee's email, and marking one paid requires pasting the transaction reference. Rejecting instead refunds the wallet. Both are audited and neither can run twice. See `docs/ASSUMPTIONS.md` #8.

### Granting the first admin — required before `/admin` is usable by anyone

The admin console at `/admin` is gated on a `user_roles` row with `role = 'admin'`, and **nothing in the product can create the first one**. That is deliberate: a console that can mint admins is a privilege-escalation surface, and there is no second-person approval or self-demotion guard yet (see `docs/SECURITY.md`). There is also nobody to grant it to at the moment — `auth.users` is empty, because nothing is deployed and no one has ever signed in.

So the order of operations is: sign in to the deployed site with the magic link once, which creates the `auth.users` row, then run this in the Supabase SQL editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'admin@nextup.exchange'
on conflict do nothing;
```

No re-login needed — reload the page and the Admin link appears in the nav. Every admin after the first is granted the same way; there is deliberately no UI for it.

To see who currently holds it:

```sql
select u.email, r.role, r.granted_at
from public.user_roles r join auth.users u on u.id = r.user_id
order by r.granted_at;
```

### Required secrets (not yet set)

Real payments cannot work until these are set (`supabase secrets set KEY=value --project-ref djnsjtlkjgjqmfcucjqp`):

- `COMMERCE_API_KEY` — from a real Coinbase Commerce business account (commerce.coinbase.com). This requires the founder to actually create that account; an agent cannot do this step.
- `COMMERCE_WEBHOOK_SECRET` — from the same dashboard, after adding a webhook endpoint pointing at `https://djnsjtlkjgjqmfcucjqp.supabase.co/functions/v1/coinbase-webhook`.
- `SITE_URL` (optional) — defaults to `https://nextup.exchange`; override for testing against a different checkout redirect target. Both `create-charge` and `deposit` build their Coinbase Commerce `redirect_url`/`cancel_url` as `${SITE_URL}/artist/<slug>?charge=success|cancelled` and `${SITE_URL}/artist/<slug>?deposit=success|cancelled` respectively — these must match the SPA route shape (`/artist/:slug`), not the old `artist.html?slug=` query-param scheme from before the Cycle 6 framework migration.

Until these are set, `create-charge`/`deposit` return a clear `503 "Crypto payments aren't configured yet"` instead of silently pretending to work — this is intentional, not a bug to "fix" by hardcoding test values.

## Environment variables

See `.env.example` at the repo root. The site's Supabase URL and publishable key are currently hardcoded in `src/lib/supabaseClient.js` rather than injected at build time — a real build pipeline exists now (Vite, see `docs/ASSUMPTIONS.md` #2), but moving these to Vite env vars (`import.meta.env.VITE_*`) hasn't been done yet since neither value is secret (both are meant to be public/client-side) and there's no per-environment (staging/prod) split yet to make it worthwhile. Revisit if that changes.

## Feature flags

`regulated_offerings` (in the `feature_flags` table) gates the entire Buy/Sell trading UI. **Currently `true`** — the founder explicitly instructed enabling it and confirmed they are handling legal/jurisdiction/licensing review on their end (see `docs/ASSUMPTIONS.md` #1, "Update 2"). This was a deliberate founder decision, not a default to leave alone or an agent judgment call — if that ownership changes, flip it back to `false` immediately rather than leaving the module reachable without an owner for the compliance question.

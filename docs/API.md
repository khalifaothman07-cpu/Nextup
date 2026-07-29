# API

NextUp has no application server of its own — the browser talks to Supabase directly (PostgREST, tables governed by RLS) plus a small set of Supabase Edge Functions for anything that needs a trusted server step (payment creation, webhook handling, atomic ledger/curve math). This doc covers the Edge Functions; table-level access is governed by the RLS policies described in `docs/DATA_MODEL.md`.

All Edge Functions live under `supabase/functions/` and are deployed to project `djnsjtlkjgjqmfcucjqp`. **None are currently deployed** — see `docs/DEPLOYMENT.md`.

## `create-charge` (`verify_jwt: true`)

Authenticated. Body: `{ track_id, slug }`. Creates a Coinbase Commerce charge for a song-ownership purchase, records a `pending` row in `crypto_charges`, returns `{ hosted_url }` to redirect the buyer to. Rejects if the track is already owned (`409`) or if `COMMERCE_API_KEY` isn't configured (`503`, not a silent failure).

## `deposit` (`verify_jwt: true`)

Authenticated. Body: `{ amount_usd_cents (>= 1000), slug }`. Creates a Coinbase Commerce charge to fund the caller's wallet, records a `pending` row in `wallet_deposits`, returns `{ hosted_url }`.

## `support-artist` (`verify_jwt: true`)

Authenticated. Body: `{ tier_id, slug }`. Looks up the tier (must be `active`), creates a Coinbase Commerce charge for `tier.price_cents`, records a `pending` row in `support_payments`, returns `{ hosted_url }`. This is the default "Back Artist" flow (master prompt §9/§11) — not the `regulatedOfferings` trading module.

## `coinbase-webhook` (`verify_jwt: false`, signature-verified instead)

Public endpoint Coinbase Commerce calls directly. Verifies `X-CC-Webhook-Signature` via HMAC-SHA256 against `COMMERCE_WEBHOOK_SECRET` (constant-time compare) before trusting anything in the body. On `charge:confirmed`, looks the charge up in `crypto_charges`, then `wallet_deposits`, then `support_payments` (a charge code is unique across all three), and dispatches accordingly: inserts `song_ownership`, calls `credit_wallet`, or calls `record_support_payment_confirmed`. Idempotent — a charge already in `confirmed` status is a no-op, and `.eq("status","pending")` on the update means only one concurrent webhook delivery wins.

## `trade` (`verify_jwt: true`) — part of the `regulatedOfferings` module

Authenticated. Body: `{ artist_id, direction: 'positive'|'negative', stake_cents (>= 100) }`. Verifies the caller's JWT with an anon-scoped client, then calls `open_position` via a service-role client, passing the verified `user.id` — the client never gets to assert whose wallet it's trading against. Returns the new position or a user-facing error (insufficient balance, insufficient curve depth for the sell size).

## `close-position` (`verify_jwt: true`) — part of the `regulatedOfferings` module

Authenticated. Body: `{ position_id }`. Same JWT-verify-then-service-role-RPC pattern as `trade`. `close_position` itself re-checks `user_id = p_user_id` on the row, so guessing another user's position id can't close it.

## Design pattern used throughout

Every write-side Edge Function follows the same shape: (1) verify the caller's JWT with an anon-scoped Supabase client, (2) do all trusted mutation through a service-role client calling a `SECURITY DEFINER` Postgres function that takes the verified `user_id` as an explicit argument. The client is never trusted with its own identity, balance, price, or ownership claims — see `docs/SECURITY.md`.

# Data Model

Reflects the actual deployed schema in Supabase project `nextup` (ref `djnsjtlkjgjqmfcucjqp`) as of this pass. Not aspirational — every table listed here exists and has RLS enabled.

## Content

- **`artists`** — `id, slug, name, genre, city, tagline, bio, accent_from, accent_to, stat_30d_pct, sort_order, claimed_by_user_id, created_at`. Public read. `claimed_by_user_id` (added this pass) is null for the current seed roster (fictional, pre-launch); will point at the owning user once artist onboarding exists.
- **`tracks`** — `id, artist_id, title, price_cents, sort_order, created_at`. Public read.

## Identity & roles (new this pass)

- **`profiles`** — `id (= auth.users.id), display_name, created_at`. Auto-created by the `handle_new_user` trigger on `auth.users` insert. Owner-only read/update.
- **`user_roles`** — `user_id, role ('admin'|'curator'), granted_at, granted_by`. Composite PK `(user_id, role)`. Owner + admin read only. No client-side writes — grants happen server-side until an admin UI exists (backlog item).
- **`artist_members`** — `artist_id, user_id, role ('owner'|'manager'|'a_r'|'marketing'|'content_editor'|'finance_viewer'), created_at`. Composite PK `(artist_id, user_id)`. Own-membership + admin/curator read only.
- **`private.has_role(user_id, role) -> boolean`** — SECURITY DEFINER helper used inside RLS policies. Deliberately lives in the `private` schema (not `public`) so it isn't exposed as a callable `/rest/v1/rpc/` endpoint — see `docs/SECURITY.md`.

## Configuration

- **`feature_flags`** — `key (pk), enabled, description, updated_at`. Public read, no client writes. Seeded row: `regulated_offerings` (`false`).
- **`jurisdiction_rules`** — `country_code (pk), regulated_offerings_allowed, notes`. Public read, no client writes. Currently empty (stub only — not enforced anywhere yet).

## Commerce — song ownership (flat-price, default path)

- **`crypto_charges`** — `id, user_id, track_id, amount_usd_cents, commerce_charge_id, status, created_at, confirmed_at`. A Coinbase Commerce charge in flight for a specific track. Owner read only; only the `coinbase-webhook` Edge Function (service role) writes `status`/`confirmed_at`.
- **`song_ownership`** — `id, user_id, track_id (unique), price_cents, created_at`. One owner per track, written only by the webhook after a confirmed charge.
- **`track_ownership_public`** (view) — `track_id, owned_at`. Public read, exposes ownership state without the buyer's identity. `SECURITY DEFINER` intentionally (documented, accepted advisory).

## Commerce — regulatedOfferings (feature-flagged, off by default)

This is the only backing mechanism — there is no separate tiered/subscription flow (a tiered model was built and then removed; see `docs/ASSUMPTIONS.md` #7 for why).

- **`wallets`** — `user_id (pk), balance_cents, updated_at`. Off-chain trading balance. Owner read only; balance mutated only by `open_position`/`close_position`/`credit_wallet`/`request_withdrawal`/`cancel_withdrawal_request` (all `SECURITY DEFINER`, `service_role`-only execute).
- **`wallet_deposits`** — `id, user_id, amount_usd_cents, commerce_charge_id, status, created_at, confirmed_at`. Same shape/flow as `crypto_charges`, but confirming credits `wallets.balance_cents` (via `credit_wallet`) instead of a direct entitlement.
- **`withdrawal_requests`** — `id, user_id, amount_cents, destination_address, status ('pending'|'paid'|'rejected'|'canceled'), requested_at, processed_at, notes`. Owner read only. Requesting a withdrawal (`request_withdrawal`) debits the wallet immediately and inserts a `pending` row; canceling (`cancel_withdrawal_request`, owner-only, only while still `pending`) credits the balance back. There is no automated payout — moving a request from `pending` to `paid` is a manual step, see `docs/DEPLOYMENT.md`.
- **`artist_curves`** — `artist_id (pk), supply, base_price_cents, k, updated_at`. One continuous bonding curve per artist: `price(s) = base_price_cents * exp(k * s)`. Public read (needed to display a live price).
- **`positions`** — `id, user_id, artist_id, direction ('positive'|'negative'), units, stake_cents, escrow_cents, status ('open'|'closed'|'liquidated'), entry_price_cents, close_price_cents, proceeds_cents, opened_at, closed_at`. Owner read only; written only by `open_position`/`close_position`.
- **`open_position(user_id, artist_id, direction, stake_cents)`**, **`close_position(user_id, position_id)`**, **`request_withdrawal(user_id, amount_cents, destination_address)`**, **`cancel_withdrawal_request(user_id, request_id)`** — `SECURITY DEFINER` Postgres functions, row-locked to serialize concurrent operations on the same wallet/curve. `EXECUTE` granted only to `service_role` (see `docs/SECURITY.md` for why this needed a follow-up fix the first time).

## Growth

- **`waitlist_signups`** — `id, email (unique), source, created_at`. Public insert-only (intentionally permissive — a lead-capture form), no read.

## Not yet built (see `docs/ARCHITECTURE.md` for sequencing)

The master prompt's full entity list (`SupportTier`, `SupportSubscription`, `SupportPayment`, `Benefit`, `BenefitEntitlement`, `ArtistPost`, `Comment`, `Reaction`, `Poll`, `PollOption`, `PollVote`, `Product`, `ProductVariant`, `InventoryRecord`, `Order`, `OrderItem`, `PaymentRecord`, `RefundRecord`, `CommunityMembership`, `Notification`, `NotificationPreference`, `Scene`, `Genre`, `ArtistScene`, `SearchRecord`, `DiscoveryEvent`, `LedgerAccount`, `LedgerTransaction`, `LedgerEntry`, `Report`, `ModerationAction`, `AuditLog`, `ArtistLead`, `ArtistLeadNote`, `ArtistLeadActivity`, `ArtistMetricSnapshot`, `ArtistMomentumScore`, `ArtistFollow`, `ArtistSave`, `ArtistVerification`) does not exist yet. None of it is faked or stubbed in the UI.

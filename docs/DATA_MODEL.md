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

## Commerce — default support flow (tiered "Back Artist")

- **`support_tiers`** — `id, artist_id, name, price_cents, billing_frequency ('one_time'|'monthly'), description, benefits (jsonb text array), sort_order, active, created_at`. Public read (active tiers only). Seeded with 3 tiers per artist (Early Supporter / Core Supporter / Inner Circle). Benefits are a plain text array on the tier rather than a separate `Benefit`/`BenefitEntitlement` join table — see `docs/ASSUMPTIONS.md` #7 for why.
- **`support_subscriptions`** — `id, user_id, artist_id, tier_id, billing_frequency, status ('active'|'canceled'|'past_due'|'expired'), started_at, current_period_end, canceled_at`. One row per `(user_id, artist_id)` — supporting a new tier for the same artist replaces the existing subscription rather than stacking. Owner read only. Owner may `UPDATE` their own row but only to set `status = 'canceled'`; everything else (creation, renewal, tier changes) is written only by `record_support_payment_confirmed`.
- **`support_payments`** — `id, user_id, artist_id, tier_id, amount_usd_cents, commerce_charge_id, status, created_at, confirmed_at`. Same shape/flow as `crypto_charges`/`wallet_deposits`. Owner read only; only the webhook writes `status`/`confirmed_at`.
- **`record_support_payment_confirmed(user_id, artist_id, tier_id, billing_frequency)`** — `SECURITY DEFINER`, `service_role`-only. Upserts the `(user_id, artist_id)` subscription. For monthly tiers, extends `current_period_end` from the later of "now" or the existing period end, so renewing early doesn't forfeit already-paid-for time.

**Important limitation**: "monthly" billing is period-tracking only, not auto-charging. Coinbase Commerce has no stored-payment-method mechanism, so there is no way to charge a supporter automatically when their period ends — see `docs/ASSUMPTIONS.md` #7. The UI must prompt for a fresh checkout each period; this is not built yet (a subscription whose `current_period_end` has passed currently just sits there without a renew prompt).

## Commerce — regulatedOfferings (feature-flagged, off by default)

- **`wallets`** — `user_id (pk), balance_cents, updated_at`. Off-chain trading balance. Owner read only; balance mutated only by `open_position`/`close_position`/`credit_wallet` (all `SECURITY DEFINER`, `service_role`-only execute).
- **`wallet_deposits`** — `id, user_id, amount_usd_cents, commerce_charge_id, status, created_at, confirmed_at`. Same shape/flow as `crypto_charges`, but confirming credits `wallets.balance_cents` (via `credit_wallet`) instead of a direct entitlement.
- **`artist_curves`** — `artist_id (pk), supply, base_price_cents, k, updated_at`. One continuous bonding curve per artist: `price(s) = base_price_cents * exp(k * s)`. Public read (needed to display a live price).
- **`positions`** — `id, user_id, artist_id, direction ('positive'|'negative'), units, stake_cents, escrow_cents, status ('open'|'closed'|'liquidated'), entry_price_cents, close_price_cents, proceeds_cents, opened_at, closed_at`. Owner read only; written only by `open_position`/`close_position`.
- **`open_position(user_id, artist_id, direction, stake_cents)`** and **`close_position(user_id, position_id)`** — `SECURITY DEFINER` Postgres functions, row-locked on the curve and wallet to serialize concurrent trades. `EXECUTE` granted only to `service_role` (see `docs/SECURITY.md` for why this needed a follow-up fix).

## Growth

- **`waitlist_signups`** — `id, email (unique), source, created_at`. Public insert-only (intentionally permissive — a lead-capture form), no read.

## Not yet built (see `docs/ARCHITECTURE.md` for sequencing)

The master prompt's full entity list (`SupportTier`, `SupportSubscription`, `SupportPayment`, `Benefit`, `BenefitEntitlement`, `ArtistPost`, `Comment`, `Reaction`, `Poll`, `PollOption`, `PollVote`, `Product`, `ProductVariant`, `InventoryRecord`, `Order`, `OrderItem`, `PaymentRecord`, `RefundRecord`, `CommunityMembership`, `Notification`, `NotificationPreference`, `Scene`, `Genre`, `ArtistScene`, `SearchRecord`, `DiscoveryEvent`, `LedgerAccount`, `LedgerTransaction`, `LedgerEntry`, `Report`, `ModerationAction`, `AuditLog`, `ArtistLead`, `ArtistLeadNote`, `ArtistLeadActivity`, `ArtistMetricSnapshot`, `ArtistMomentumScore`, `ArtistFollow`, `ArtistSave`, `ArtistVerification`) does not exist yet. None of it is faked or stubbed in the UI.

# Data Model

Reflects the actual deployed schema in Supabase project `nextup` (ref `djnsjtlkjgjqmfcucjqp`) as of this pass. Not aspirational — every table listed here exists and has RLS enabled.

## Content

- **`artists`** — `id, slug, name, genre, city, tagline, bio, accent_from, accent_to, stat_30d_pct, sort_order, claimed_by_user_id, follower_count, created_at`. Public read. `claimed_by_user_id` is null for the current seed roster (fictional, pre-launch); will point at the owning user once artist onboarding exists. `follower_count` (Cycle 7) is a public aggregate maintained solely by the `private.bump_follower_count()` trigger on `artist_follows` — never written by clients. **Team editing (Cycle 9)**: members of `artist_members` with role `owner`/`manager`/`content_editor` may UPDATE their own artist's row, and only the profile columns (`name, tagline, bio, genre, city, accent_from, accent_to`) — enforced by column-level grants (blanket UPDATE revoked from `anon`/`authenticated`) plus a membership-checked RLS policy. Structural/financial columns (`slug`, `follower_count`, `sort_order`, `stat_30d_pct`, `claimed_by_user_id`) are un-updatable from any client role. `stat_30d_pct` is a **legacy seeded placeholder no longer displayed anywhere** (replaced by real momentum, below); kept only to avoid a pointless destructive migration, safe to drop later.
- **`tracks`** — `id, artist_id, title, price_cents, sort_order, created_at`. Public read.

## Discovery (Cycle 7)

- **`artist_follows`** — `user_id, artist_id, created_at`, composite PK `(user_id, artist_id)`. Own rows only for select/insert/delete (`auth.uid() = user_id`) — a user can see and manage only their own follows; the public never sees who follows whom, only the trigger-maintained `artists.follower_count` total. Indexed on `(artist_id, created_at)` for the momentum aggregation.
- **`artist_momentum_daily`** — `artist_id, day (composite PK), follows_7d, trades_7d, trade_volume_cents_7d, purchases_7d, followers_total, score, computed_at`. Public read. One historized snapshot per artist per day, written only by `private.compute_momentum()` (SECURITY DEFINER, `EXECUTE` revoked from `anon`/`authenticated`/`public` per the standard pattern). Scheduled daily at 00:15 UTC via pg_cron (job name `compute-momentum-daily`), which runs as `postgres` and needs no client-facing grants.
- **Score formula** (explainable by design — the UI shows this exact breakdown): `score = follows_7d × 3 + trades_7d × 5 + purchases_7d × 8 + floor(trade_volume_cents_7d / 1000)` — i.e. +1 per $10 of stake traded. Inputs are exclusively real platform activity (`artist_follows`, `positions.opened_at`, `song_ownership.created_at`, each over a trailing 7 days). The weights are product tuning, not science — change them here and in `private.compute_momentum()` together. Seed artists legitimately score 0 until real activity exists; the UI presents that as-is rather than inventing numbers.

## Identity & roles (new this pass)

- **`profiles`** — `id (= auth.users.id), display_name, created_at`. Auto-created by the `handle_new_user` trigger on `auth.users` insert; owner-insert also allowed (Cycle 8) so the client-side upsert self-heals users that predate the trigger (existing gaps were backfilled in the same migration). Owner-only read/update.
- **`user_roles`** — `user_id, role ('admin'|'curator'), granted_at, granted_by`. Composite PK `(user_id, role)`. Owner + admin read only. No client-side writes — grants happen server-side until an admin UI exists (backlog item).
- **`artist_members`** — `artist_id, user_id, role ('owner'|'manager'|'a_r'|'marketing'|'content_editor'|'finance_viewer'), created_at`. Composite PK `(artist_id, user_id)`. Own-membership + admin/curator read only.
- **`private.has_role(user_id, role) -> boolean`** — SECURITY DEFINER helper used inside RLS policies. Deliberately lives in the `private` schema (not `public`) so it isn't exposed as a callable `/rest/v1/rpc/` endpoint — see `docs/SECURITY.md`.

## Configuration

- **`feature_flags`** — `key (pk), enabled, description, updated_at`. Public read, no client writes. Seeded row: `regulated_offerings` (`false`).
- **`jurisdiction_rules`** — `country_code (pk), regulated_offerings_allowed, notes`. Public read, no client writes. Currently empty (stub only — not enforced anywhere yet).

## Commerce — song ownership (flat-price, default path)

- **`crypto_charges`** — `id, user_id, track_id, amount_usd_cents, commerce_charge_id, status, created_at, confirmed_at`. A Coinbase Commerce charge in flight for a specific track. Owner read only; only the `coinbase-webhook` Edge Function (service role) writes `status`/`confirmed_at`.
- **`song_ownership`** — `id, user_id, track_id (unique), price_cents, created_at`. One owner per track, written **only** by the webhook after a confirmed charge — enforced for real as of Cycle 8, which dropped a leftover client `INSERT` policy from the pre-Coinbase prototype that contradicted this line (see `docs/SECURITY.md`, "Found-and-fixed").
- **`track_ownership_public`** (view) — `track_id, owned_at`. Public read, exposes ownership state without the buyer's identity. `SECURITY DEFINER` intentionally (documented, accepted advisory).

## Commerce — regulatedOfferings (feature-flagged, off by default)

This is the only backing mechanism — there is no separate tiered/subscription flow (a tiered model was built and then removed; see `docs/ASSUMPTIONS.md` #7 for why).

- **`wallets`** — `user_id (pk), balance_cents, updated_at`. Off-chain trading balance. Owner read only; balance mutated only by `open_position`/`close_position`/`credit_wallet`/`request_withdrawal`/`cancel_withdrawal_request` (all `SECURITY DEFINER`, `service_role`-only execute).
- **`wallet_deposits`** — `id, user_id, amount_usd_cents, commerce_charge_id, status, created_at, confirmed_at`. Same shape/flow as `crypto_charges`, but confirming credits `wallets.balance_cents` (via `credit_wallet`) instead of a direct entitlement.
- **`withdrawal_requests`** — `id, user_id, amount_cents, destination_address, status ('pending'|'paid'|'rejected'|'canceled'), requested_at, processed_at, notes`. Owner read only. Requesting a withdrawal (`request_withdrawal`) debits the wallet immediately and inserts a `pending` row; canceling (`cancel_withdrawal_request`, owner-only, only while still `pending`) credits the balance back. There is no automated payout — moving a request from `pending` to `paid` is a manual step, see `docs/DEPLOYMENT.md`.
- **`artist_curves`** — `artist_id (pk), supply, base_price_cents, k, updated_at`. One continuous bonding curve per artist: `price(s) = base_price_cents * exp(k * s)`. Public read (needed to display a live price).
- **`positions`** — `id, user_id, artist_id, direction ('positive'|'negative'), units, stake_cents, escrow_cents, status ('open'|'closed'|'liquidated'), entry_price_cents, close_price_cents, proceeds_cents, opened_at, closed_at`. Owner read only; written only by `open_position`/`close_position`.
- **`open_position(user_id, artist_id, direction, stake_cents)`**, **`close_position(user_id, position_id)`**, **`request_withdrawal(user_id, amount_cents, destination_address)`**, **`cancel_withdrawal_request(user_id, request_id)`** — `SECURITY DEFINER` Postgres functions, row-locked to serialize concurrent operations on the same wallet/curve. `EXECUTE` granted only to `service_role` (see `docs/SECURITY.md` for why this needed a follow-up fix the first time).

## Artist onboarding (Cycle 12)

- **`artist_applications`** — `id, user_id (unique, → auth.users), artist_name, city, genre, links, about, status ('pending'|'reviewing'|'accepted'|'declined'), created_at, reviewed_at, review_notes`. One application per account. Applicant can `INSERT` and `SELECT` their own; admins/curators can `SELECT` all (via `private.has_role`) so Phase 6's console has real rows to review. `UPDATE`/`DELETE` are **revoked from `anon`/`authenticated`** — no policy exists for them either, so an applicant cannot move their own application to `accepted`. Length `CHECK`s on every text column. Indexed on `(status, created_at desc)` for the review queue.
- **`artist_applications.onboarded_artist_id`** (Cycle 13) — `uuid → artists(id)`, null until the application has been turned into a real artist page. It is what makes onboarding idempotent: `admin_onboard_application` refuses an application that already has one, so a double-press cannot produce two artist pages for the same act.
- **Review happens in the admin console** as of Cycle 13 (`/admin`) — an admin sets status, writes a note, and presses "Create artist page", which does the whole grant in one transaction. Emailing the applicant is still a person's job, and the console shows the address to write to. Before Cycle 13 both halves were hand-written SQL.

## Internal platform (Cycle 13)

- **`audit_log`** — `id (bigint identity pk), actor_user_id, action, entity, entity_id, detail jsonb, created_at`. Admin-only `SELECT` via `private.has_role(auth.uid(), 'admin')`; `INSERT`/`UPDATE`/`DELETE` **revoked from `anon` and `authenticated`** and given no policy either, so the only writer is the `admin_*` definer functions running as the table owner. Not even an admin can edit or delete a row from the client — an audit trail its own subjects can rewrite is not an audit trail. Indexed on `created_at desc`.
- **`admin_review_application(p_application_id, p_status, p_notes)` → `artist_applications`** — sets status / `review_notes` / `reviewed_at` and writes an `application.reviewed` audit row.
- **`admin_onboard_application(p_application_id)` → `artists`** — the real onboarding step, all in one transaction: slugifies the artist name (`[^a-z0-9]+` → `-`, with a uniqueness loop for collisions), inserts the `artists` row and its `artist_curves` row, inserts an `artist_members` `owner` row for the applicant, sets `artists.claimed_by_user_id`, marks the application `accepted`, links it via `onboarded_artist_id`, and writes an `application.onboarded` audit row. Raises if the application already has an artist page.
- **`admin_set_feature_flag(p_key, p_enabled)` → `feature_flags`** — flips a flag and writes a `feature_flag.set` audit row. Raises on an unknown key rather than silently creating one.
- **`admin_list_applications()`** and **`admin_list_audit(p_limit)`** — the read-side companions. Row visibility was already correct via RLS; these exist for the one column RLS cannot reach — the applicant's/actor's email lives in `auth.users`, which no client-facing policy can expose, and a review queue that can't show you who to email can't finish its job.
- **`withdrawal_requests.tx_reference`** (Cycle 14) — the on-chain hash for a paid withdrawal. `admin_mark_withdrawal_paid` refuses a blank one: an operator should not be able to record that they sent funds without recording what they sent, and without it the audit row says nothing useful.
- **`admin_list_withdrawals(p_limit)`** — the payout queue, pending first, joined to the payee's email and their current wallet balance. Same reason as the applications reader: the email lives in `auth.users`, which RLS cannot expose.
- **`admin_mark_withdrawal_paid(p_request_id, p_tx_reference)` → `withdrawal_requests`** — locks the row, requires it still be `pending`, requires a non-empty reference, sets `paid`, writes a `withdrawal.paid` audit row. **Moves no money**: `request_withdrawal` already debited the wallet when the user asked.
- **`admin_reject_withdrawal(p_request_id, p_reason)` → `withdrawal_requests`** — locks the row, requires `pending`, **credits the amount back to the wallet**, sets `rejected` with the reason in `notes`, writes a `withdrawal.rejected` audit row.
- **The asymmetry between those two is the whole point of the slice.** Because the debit happens at request time, paying moves nothing and rejecting must refund. Getting it backwards in either direction silently takes money from a user — pay-that-refunds double-spends, reject-that-doesn't leaves them short with nothing sent. Both directions are probed.
- **All eight are `SECURITY DEFINER`, take no `user_id` argument, read `auth.uid()` themselves, and refuse any caller without the `admin` role** — the deliberate opposite of the `service_role`-only pattern used by `open_position`/`request_withdrawal`. `docs/SECURITY.md` explains why the two shapes need different grants.

## Growth

- **`waitlist_signups`** — `id, email (unique), source, created_at`. Public insert-only (intentionally permissive — a lead-capture form), no read.

## Not yet built (see `docs/ARCHITECTURE.md` for sequencing)

The master prompt's full entity list (`SupportTier`, `SupportSubscription`, `SupportPayment`, `Benefit`, `BenefitEntitlement`, `ArtistPost`, `Comment`, `Reaction`, `Poll`, `PollOption`, `PollVote`, `Product`, `ProductVariant`, `InventoryRecord`, `Order`, `OrderItem`, `PaymentRecord`, `RefundRecord`, `CommunityMembership`, `Notification`, `NotificationPreference`, `Scene`, `Genre`, `ArtistScene`, `SearchRecord`, `DiscoveryEvent`, `LedgerAccount`, `LedgerTransaction`, `LedgerEntry`, `Report`, `ModerationAction`, `AuditLog`, `ArtistLead`, `ArtistLeadNote`, `ArtistLeadActivity`, `ArtistMetricSnapshot`, `ArtistVerification`) does not exist yet — though `ArtistFollow` and `ArtistMomentumScore` are now covered by `artist_follows`/`artist_momentum_daily` above (`ArtistSave` was folded into follow rather than built as a separate near-duplicate concept). None of the rest is faked or stubbed in the UI.

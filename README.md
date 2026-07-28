# Nextup — Landing Page + Artist Profiles

Static multi-page site (no build step). Backend is Supabase — data and auth are called directly from the browser via the `anon`/publishable key, protected by row-level security. Payments are crypto-only, via Coinbase Commerce.

Nextup is global — there's no regional rollout or eligibility gate baked into the product.

## Run it locally / preview edits

From this folder:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser. Refresh after any edit — no build/compile step needed.

## Before committing

Run `npx prettier --write .` (or `npm run format`) before every commit — CI has no separate lint/build step, so this is the only formatting gate. `npm run format:check` fails without writing, useful in CI.

## Structure

- `index.html` — landing page: hero, how-it-works, pricing/tiers, live artist roster, about, FAQ, press contact, waitlist.
- `artist.html?slug=<slug>` — per-artist profile: bio, track list ("Side B" — own a song), backing panel ("Side A" — back the artist). Both flows redirect to a Coinbase Commerce hosted checkout.
- `css/styles.css` — shared design system.
- `js/supabase-client.js` — Supabase client init (project URL + publishable key).
- `js/app.js` — shared helpers: waitlist submission, auth widget (magic-link sign-in), scroll reveal.
- `supabase/functions/create-charge/` — Edge Function: authenticated user requests a charge for a backing or song purchase; creates a Coinbase Commerce charge and returns the hosted checkout URL.
- `supabase/functions/coinbase-webhook/` — Edge Function: receives Coinbase Commerce's `charge:confirmed` webhook, verifies its signature, and records the backing/song ownership.

## Backend (Supabase)

Dedicated project `nextup` (org: khalifaothman07-cpu's Org, region ap-south-1) — **not** shared with the Unbeatable app's project.

Tables: `waitlist_signups`, `artists`, `tracks`, `backings` (Side A), `song_ownership` (Side B), `crypto_charges` (tracks each Coinbase Commerce charge from creation through confirmation), plus a `track_ownership_public` view that exposes ownership status without leaking buyer identity. All tables have RLS enabled:

- `artists` / `tracks`: public read.
- `waitlist_signups`: public insert only.
- `backings` / `song_ownership` / `crypto_charges`: authenticated users can insert/read only their own rows. `backings` and `song_ownership` rows are only ever written server-side (by the webhook, using the service role key) once a charge is confirmed — the client never inserts into them directly.

Auth is email magic-link (Supabase Auth OTP) — no passwords.

## Crypto payments (Coinbase Commerce)

Checkout accepts BTC, ETH, USDC, and whatever else Coinbase Commerce supports — pricing is set in USD and Coinbase converts it at checkout, so no single volatile asset is hardcoded into the product.

**Flow:** user clicks "Own this song" / "Back this artist" → `create-charge` Edge Function creates a Coinbase Commerce charge and a `pending` row in `crypto_charges` → user pays on Coinbase's hosted page → Coinbase calls the `coinbase-webhook` Edge Function on confirmation → the webhook verifies the signature and writes the real `backings` / `song_ownership` row.

**To actually accept payments, this still needs, from you:**

1. A Coinbase Commerce account (business account, their own KYC) at commerce.coinbase.com.
2. An API key from that account, set as an Edge Function secret: `supabase secrets set COMMERCE_API_KEY=... --project-ref djnsjtlkjgjqmfcucjqp`
3. A webhook endpoint added in the Coinbase Commerce dashboard pointing at `https://djnsjtlkjgjqmfcucjqp.supabase.co/functions/v1/coinbase-webhook`, and its shared secret set the same way: `supabase secrets set COMMERCE_WEBHOOK_SECRET=... --project-ref djnsjtlkjgjqmfcucjqp`
4. Optionally `SITE_URL` (defaults to `https://nextup.exchange`) if checkout should redirect somewhere else during testing.

Until those secrets are set, `create-charge` returns a clear "crypto payments aren't configured yet" error instead of pretending to work — no partial/fake charges.

I couldn't deploy the two Edge Functions myself this pass (the deploy tool call needs your approval) — their source is committed under `supabase/functions/`; deploy them with `supabase functions deploy create-charge` / `supabase functions deploy coinbase-webhook --no-verify-jwt` once you're set up, or grant the tool approval and I'll deploy them directly.

## Status

Not deployed anywhere. Do not deploy / publish without explicit approval — keep all work local or in a private preview until given the go-ahead.

Domain: `nextup.exchange` (acquired, not yet connected to anything).

## Known follow-ups (not yet built)

- Coinbase Commerce account isn't set up yet — see "Crypto payments" above for what's needed to go from code-complete to actually able to charge someone.
- Edge Functions are written but not deployed (blocked on tool approval — see above).
- No real audio playback for tracks yet — "Spin" behavior on the landing page is a visual demo only.
- Artist roster (Marra Vale, Dry Season, etc.) is placeholder/fictional — swap for real assets when available.
- No admin/artist-facing tools yet (roster is seeded directly via SQL).

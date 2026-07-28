# Nextup — Landing Page + Artist Profiles

Static multi-page site (no build step). Backend is Supabase — data and auth are called directly from the browser via the `anon`/publishable key, protected by row-level security.

## Run it locally / preview edits
From this folder:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser. Refresh after any edit — no build/compile step needed.

## Structure
- `index.html` — landing page: hero, how-it-works, pricing/tiers, live artist roster, about, FAQ, press contact, waitlist.
- `artist.html?slug=<slug>` — per-artist profile: bio, track list ("Side B" — own a song), backing panel ("Side A" — back the artist).
- `css/styles.css` — shared design system.
- `js/supabase-client.js` — Supabase client init (project URL + publishable key).
- `js/app.js` — shared helpers: waitlist submission, auth widget (magic-link sign-in), scroll reveal.

## Backend (Supabase)
Dedicated project `nextup` (org: khalifaothman07-cpu's Org, region ap-south-1) — **not** shared with the Unbeatable app's project.

Tables: `waitlist_signups`, `artists`, `tracks`, `backings` (Side A), `song_ownership` (Side B), plus a `track_ownership_public` view that exposes ownership status without leaking buyer identity. All tables have RLS enabled:
- `artists` / `tracks`: public read.
- `waitlist_signups`: public insert only.
- `backings` / `song_ownership`: authenticated users can insert/read only their own rows.

Auth is email magic-link (Supabase Auth OTP) — no passwords.

## Status
Not deployed anywhere. Do not deploy / publish without explicit approval — keep all work local or in a private preview until given the go-ahead.

Domain: `nextup.exchange` (acquired, not yet connected to anything).

## Known follow-ups (not yet built)
- No real audio playback for tracks yet — "Spin" behavior on the landing page is a visual demo only.
- Artist roster (Marra Vale, Dry Season, etc.) is placeholder/fictional — swap for real assets when available.
- Backing/ownership amounts are not connected to real payments — inserts just record intent to back/own; no charge occurs.
- No admin/artist-facing tools yet (roster is seeded directly via SQL).

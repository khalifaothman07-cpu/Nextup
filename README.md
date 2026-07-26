# Nextup — Landing Page

Single-file static site. No build step, no dependencies beyond Google Fonts (loaded via CDN link in `<head>`).

## Run it locally / preview edits
From this folder:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser. Refresh after any edit to `index.html` to see the change — no build/compile step needed.

(Alternatively just double-click `index.html` to open it directly in a browser — works fine since there's no server-side code, only the http.server method supports relative-path fetches if that's ever added later.)

## Structure
- `index.html` — everything: markup, CSS (in a `<style>` block), and JS (in a `<script>` block) for the waitlist form interaction, the scroll-reveal animations, and the interactive artist card (photo → gradient + spinning vinyl discs).

## Status
Not deployed anywhere. Do not deploy / publish without explicit approval — keep all work local or in a private preview until given the go-ahead.

## Known follow-ups (not yet built)
- Waitlist form is front-end only — submissions aren't captured anywhere yet.
- Artist roster (Marra Vale, Dry Season, etc.) is placeholder/fictional — swap for real assets when available.

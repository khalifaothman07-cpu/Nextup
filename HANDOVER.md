# Handover

This project is being transferred. Everything below is what a new engineer needs
to take it over, in the order they need it.

The rest of `docs/` is the reasoning behind the code and stays accurate — it was
written as the work happened, not reconstructed afterwards. This file is the map
to it.

---

## 0. Read this first: the product has an unresolved funding problem

Not a bug. A gap in the commercial model that shows up as arithmetic.

`open_position` debits the user's wallet by the stake and the stake **goes
nowhere**. `close_position` credits proceeds that **come from nowhere**. The
bonding curve behind the "Back the Artist" product has no reserve. Money is
destroyed on open and conjured on close.

Nothing throws. No constraint is violated. Every row is internally consistent,
which is why it survived fifteen development cycles unnoticed — it only became
visible once a double-entry ledger existed to ask whether obligations were
covered. Measured end to end: a $100 deposit is fully covered; one $20 stake
closed at a profit leaves obligations of $109.84 against holdings of $100.00.

**Consequences for whoever picks this up:**

- The `regulated_offerings` feature flag must stay **off** for any real money.
  It gates the entire Buy/Sell surface. Deposits, withdrawals and track
  purchases are unaffected and reconcile cleanly.
- Fixing this is not primarily an engineering task. Somebody has to decide how
  much capital stands behind the product and what the maximum exposure is. The
  accounting to enforce a reserve exists; the number does not.
- `docs/ARCHITECTURE.md` → "Architectural risks" → risk 0 has the full
  write-up. `docs/board-appendix.html` Section 06 is the non-technical version.

---

## 1. The database is not in this repository

The app is here. The schema is not. Every migration was applied through
Supabase's migration history, and that history is the only copy.

```bash
npm i -g supabase
supabase login
bash scripts/pull-schema.sh <project-ref>   # writes supabase/migrations/, then commit it
```

Do this on day one. Until it is done, this repo is one dashboard action away
from losing the definitions of its money functions, its RLS policies and its
ledger. There are 32 migrations as of transfer, from `stage_2_core_schema`
through `pin_ledger_balance_trigger_search_path`.

You need dashboard access to the Supabase project to do this, which is part of
what has to be transferred (§3).

---

## 2. Running it

```bash
npm ci
npm run dev            # http://localhost:5173
npm run build          # static output in dist/
```

The Supabase URL and publishable key are hardcoded in
`src/lib/supabaseClient.js` rather than injected from env. Neither is secret —
the publishable key is designed to be public and RLS is what protects the data —
but there is no staging/production split, so **the dev server talks to the
production database**. Point it somewhere else before experimenting.

Auth is magic-link only. There is no password flow.

---

## 3. Accounts and secrets that must change hands

None of these are in the repo, and the code is not useful without them:

| What                              | Why it matters                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Supabase project (owner transfer) | Database, auth, edge functions, and the only copy of the schema                                             |
| The first `admin` role grant      | `/admin` is gated on a row in `user_roles`. Granting it is SQL-only by design — see `docs/DEPLOYMENT.md`    |
| Coinbase Commerce account         | `COMMERCE_API_KEY`, `COMMERCE_WEBHOOK_SECRET`. Never provisioned — payments have never processed real value |
| Domain / DNS (`nextup.exchange`)  | Referenced as the default `SITE_URL`                                                                        |
| Hosting                           | `public/_redirects` is Netlify-shaped SPA fallback; nothing is deployed                                     |

`.env.example` documents the server-side secrets and where they go.

---

## 4. What is deployed: essentially nothing

- **Frontend**: never deployed. `npm run build` produces a static `dist/`.
- **Edge functions**: seven exist in `supabase/functions/`. **Six are not
  deployed**, and four of those changed for rate-limit handling after the last
  deploy. `bash scripts/deploy-functions.sh` deploys them; it has never been
  run by the author.
- **Database**: live and current. This is the only part of the system that is
  actually running.
- **Payments**: no Commerce account, so `create-charge` and `deposit` return a
  clean 503 rather than pretending to work.

Two Supabase settings are configured in the dashboard rather than in code and
were never done: **Auth rate limits + CAPTCHA**, and a **custom SMTP provider**.
The built-in SMTP has a low project-wide hourly ceiling shared across all users —
one abuser exhausts it for everybody. See `docs/SECURITY.md`.

---

## 5. Repo map

```
src/            React 18 SPA. Pages under src/pages, no TypeScript.
css/styles.css  The entire visual system in one hand-written sheet (~3100 lines).
                Design tokens at the top, dual light/dark themes, self-hosted
                variable fonts. There is no Tailwind and no component library.
public/fonts/   Self-hosted woff2. Deliberately not CDN-linked — see the comment
                at the top of styles.css for why.
supabase/functions/   Seven Deno edge functions. Every money mutation goes
                      through one of these.
preview/        Template + fixture data for the static preview builder.
scripts/        Build, verification and deploy tooling (§6).
docs/           Architecture, data model, security, deployment, assumptions,
                and a per-cycle implementation log.
```

**Two documents in `docs/` are for outside readers, not engineers**:
`founder-pack.html` and `board-appendix.html`. Both carry a `{{FONTS}}` token
and are rendered with `node scripts/build-docs.mjs`. The appendix is sanitized
for circulation outside the company — `scripts/check-board-appendix.mjs` fails
the build if an infrastructure identifier, function name or deployment command
gets back into it. Run it after any edit to that file.

---

## 6. Scripts

| Command                                 | Does                                                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                         | Vite production build                                                                                                                                                                                                 |
| `npm run format`                        | Prettier over everything                                                                                                                                                                                              |
| `node scripts/screenshot.mjs`           | Visual harness. Renders the real build in headless Chromium against mocked PostgREST, including signed-in and admin pages. Needs `npm run preview -- --port 8200 --strictPort` running first. Writes to `dist/shots/` |
| `node scripts/build-preview.mjs`        | Static single-file mirrors of the app for sharing                                                                                                                                                                     |
| `node scripts/preview-smoke.mjs`        | Walks every route in those mirrors                                                                                                                                                                                    |
| `node scripts/build-docs.mjs`           | Renders the two board-facing HTML documents                                                                                                                                                                           |
| `node scripts/check-board-appendix.mjs` | Sanitization gate for the appendix                                                                                                                                                                                    |
| `bash scripts/deploy-functions.sh`      | Deploys the edge functions                                                                                                                                                                                            |
| `bash scripts/pull-schema.sh <ref>`     | Pulls the schema (§1)                                                                                                                                                                                                 |

Set `CHROMIUM_PATH` if your environment ships its own Chromium; otherwise
`npx playwright install chromium` once.

**The harness is worth keeping.** Its first run caught four defects that were
already committed and passing `npm run build` — money rounded to whole dollars,
a role label rendering as `content&editor`, "1 songs purchased", and marketing
spacing on tool pages. It also carries a structural style guard and an
unstyled-class sweep, both added after a CSS edit silently deleted the rules for
nine pages while every build stayed green.

---

## 7. Things that will bite you

**Two shapes of `SECURITY DEFINER` function, two different correct grants.** A
function that takes `user_id` as an argument believes whatever it is handed and
must be `service_role`-only. A function that reads `auth.uid()` and checks the
role itself is correctly granted to `authenticated`. Getting this backwards in
either direction is a real vulnerability, and both mirror-image mistakes have
already been made here once each. `docs/SECURITY.md` opens with this.

**Always `revoke execute on function ... from public, anon, authenticated`** —
naming all three. Revoking one source silently leaves the others standing. This
project has been bitten from both directions.

**The security advisor is the ground truth, not a successful migration.** Run
`get_advisors(type: "security")` after every DDL change. Several lints are
accepted deliberately and documented in `docs/SECURITY.md` — don't "fix" those
into breaking the product.

**Rate limits live on tables, not in edge functions.** A limit inside a function
is skipped the moment somebody calls PostgREST directly, and every one of these
tables is reachable that way.

**Per-IP limiting is weaker than it looks.** Proven accidentally: a seven-request
test all passed because the test machine's egress IP rotated across a pool. The
real answer for signup abuse is a CAPTCHA.

**There is no automated test suite.** Not for RLS boundaries, not for the money
paths, not for anything. Every security property in `docs/SECURITY.md` was
verified by hand with targeted probes, and the probes were not kept. This is the
largest engineering gap in the project and it is worse than any missing feature:
three of the four real security findings here were caught only because somebody
remembered to look.

**A probe that cannot fail is worse than no probe.** Recorded because it
happened: a withdrawal test read balances with a plain `select`, RLS correctly
refused, `null` came back, and every assertion passed against nothing.

---

## 8. Decisions that were never made

These are business decisions the code is waiting on, not open tickets:

1. **Regulatory classification of the Backing product.** It may attract
   securities, derivatives, custody, gaming or virtual-asset regulation
   depending on jurisdiction. `regulated_offerings` is currently flagged on in
   the database at the founder's explicit instruction, with the founder owning
   the legal position. Anyone taking this over should re-examine that before
   real money moves.
2. **What "Own the Song" actually conveys.** The product sells "permanent
   ownership of a track" and the Terms deliberately say only that ownership "is
   recorded to your account". Whether that is copyright, master rights, a
   licence, a collectable, resale rights or royalty participation was never
   determined. There is also no resale mechanism, so it is non-transferable by
   omission rather than by decision.
3. **Custody model** — whether the company holds customer funds, uses a
   regulated custodian, or restructures to never take custody. The ledger was
   deliberately built to be correct under all three.
4. **The reserve** — see §0.
5. **Payout infrastructure.** Coinbase Commerce accepts inbound payment but
   cannot send funds out, which is why withdrawals are processed by hand through
   `/admin`. That is workable for a closed beta and is not an operating model.
6. **Legal review.** Terms, Risk Disclosure and Privacy are drafted and specific
   to what the product actually does, but no external counsel has read them.

`docs/board-appendix.html` sets all six out for a non-technical reader.

---

## 9. Where the history is

`docs/IMPLEMENTATION_LOG.md`, newest first, one entry per working cycle. Each
records what was built, what was verified and how, what broke, and what was
deliberately deferred — including the mistakes, which are the useful part.
`docs/ASSUMPTIONS.md` records the decisions taken without asking and is the
place to check before assuming something was an oversight.

Git history is intact and the commit messages carry the reasoning.

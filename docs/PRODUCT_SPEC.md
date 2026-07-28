# NextUp — Product Spec

Canonical reference for what NextUp is. Distilled from the founder's master prompt; when in doubt, the full prompt (kept in the session/PR history that introduced it) is the source of truth — this is the working summary engineering should build against.

## What it is

An artist discovery, support, community, commerce, and market-intelligence platform. Not a generic streaming clone, not a crowdfunding clone, not a social network, not a crypto dashboard.

Feel: Spotify-level browsing clarity + Polymarket-level information density + Nintendo hardware tactility + a collectible music marketplace + "a cultural stock exchange without presenting regulated securities."

## Core loop

Discover an emerging artist → understand their momentum through clear data → follow → support via recurring membership → purchase artist offerings → participate in their community → track progress over time → receive benefits/access/merch/status/voting where legally permitted.

## Terminology rules (binding)

- Never describe ordinary users as purchasing equity, securities, ownership in artists, or guaranteed returns.
- Public default label for the support action: **"Back Artist"**. Internal code may call it `artistBacking`. Public wording is configuration-controlled, not hardcoded, so it can change per jurisdiction.
- Internal currency defaults to **"NextUp Credits"** publicly, until an approved token model is activated. Code may reference `NextCoin` internally but must not represent it as a cryptocurrency, imply guaranteed value, or imply cash-out unless a compliant system is actually configured.
- The tradable, continuously-priced Buy/Sell mechanic (see `docs/ASSUMPTIONS.md` #1) lives in a `regulatedOfferings` domain, feature-flagged **off by default**. It is never the default backing flow.

## Roles

Listener (base) · Supporter (derived: has an active support relationship, not a stored role) · Artist · Artist team member (manager / A&R / marketing / content editor / finance viewer / administrator, scoped per artist) · Platform administrator · A&R / internal curator.

## Visual identity

"2000s Nintendo hardware meets a 2026 financial market interface, introduced by Spotify." Dark mode: near-black + matte charcoal + controlled green accent. Light mode: cream/warm-white + dark text + deep red accent. Artist cards read as collectible cartridges — physical, pressable, stackable — not generic SaaS cards. See `docs/ARCHITECTURE.md` Assumption #3 for rollout status.

## Non-negotiables (§1.9–1.10)

No placeholder buttons, fake charts, dead navigation, fabricated numbers, or mock interactions in production-facing screens. Every visible action either works or is clearly marked unavailable in the current environment.

## Phase order

1. Foundation (tokens, themes, auth, roles, core schema, seed data, nav, responsive shell)
2. Discovery vertical slice
3. Support vertical slice
4. Artist operations
5. Community and commerce
6. Internal platform (admin, moderation, A&R, audit, flags, jurisdiction)
7. NextUp Credits (ledger)

Status of each phase is tracked in `docs/IMPLEMENTATION_LOG.md`, not here — this file describes what's true of the product, not what's built yet.

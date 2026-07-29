# Assumptions

Recorded per the master prompt's §1.6 requirement. Each entry states the assumption, why it was necessary, and what would change it.

## 1. `regulatedOfferings` = the bonding-curve trading system already built

Earlier in this session (before the master prompt was given), the user asked to "copy Pauv's buy and sell structure" — a prediction-market-style continuous bonding curve with Buy (positive)/Sell (negative) positions, escrow-backed shorts, and instant settlement against an internal wallet. That system (`artist_curves`, `wallets`, `wallet_deposits`, `positions`, `open_position`/`close_position`) was fully designed and deployed to the database before this master prompt arrived.

The master prompt's §11 then describes almost exactly that mechanic — "a cultural stock exchange without presenting regulated securities," continuously priced, tradable — and explicitly requires it to live in a separate `regulatedOfferings` domain that is **disabled by default and inaccessible unless explicitly configured**, distinct from the default `supportSubscriptions`/`supportPayments`/`benefitEntitlements` flow.

**Assumption**: rather than discard the trading system, it _is_ the `regulatedOfferings` module. This pass adds a `feature_flags` row (`regulated_offerings`, default `false`) and will gate the trading UI behind it. The default "Back Artist" flow described in §9/§11 (tiered, one-time/recurring, benefit entitlements) does not exist yet and is queued as the next slice — it was not what got built first, because the explicit request that produced it came before the master prompt did.

**If wrong**: if the trading system should instead be removed/archived rather than reclassified, that's a small change (flip the flag's default meaning, or drop the schema) — no data depends on it yet (all trading tables are empty).

## 2. Stack continuation vs. framework rewrite

The master prompt's §1.8 says not to replace functioning code unnecessarily, but also describes a product (role-gated dashboards, kanban A&R boards, community feeds, admin console) that a static multi-page site with hand-written `innerHTML` strings cannot reasonably support past Phase 2.

**Assumption**: continue the existing static-HTML/vanilla-JS/Supabase stack through Phase 1 (still page-shaped: landing, artist profile, foundation schema). Treat "introduce a real frontend framework" as a decision to make explicitly — not silently — before Phase 2 begins, since it's a large, user-visible architectural pivot the founder should confirm rather than discover after the fact.

**If wrong**: if the founder wants the framework decision made now rather than deferred, say so and it becomes the very next slice instead of Phase 1.5.

## 3. Visual identity (§5) not implemented this pass

The master prompt specifies a significant rebrand: near-black/charcoal/green dark mode and cream/dark-red light mode, Nintendo-cartridge-style artist cards, tactile press animations — a real departure from the ink-black/brass/violet-coral palette already shipped and previously approved by the user across several turns this session.

**Assumption**: this is a deliberate, explicit instruction (the master prompt is detailed and unambiguous about it), so it supersedes the earlier palette — but redesigning the whole visual system is its own large slice, not something to bundle silently into an RBAC/schema pass. Deferred to the design-tokens slice called out in `docs/ARCHITECTURE.md`'s implementation sequence, not skipped.

**If wrong**: if the existing brass/ink palette should be kept instead, that's a one-line change to the plan (drop the §5 redesign from the backlog).

## 4. Single-session scope realism

The master prompt describes what is genuinely a multi-month platform (RBAC, momentum engine with historized scoring, ledger, marketplace, community, A&R pipeline, admin console, notifications, analytics, full test suite, compliance/jurisdiction rules). §30's "Definition of Done" and §1.9–1.10 ("no placeholder buttons, no fake charts, no dead navigation... every visible action must work or be clearly marked unavailable") make faking breadth across all of it explicitly against the spec.

**Assumption**: deliver Phase 1 as a genuinely complete, working slice per the prompt's own §31 working style (state the slice, implement it, verify it, log it, recommend next), rather than producing shallow stubs across many phases. Every subsequent turn/session continues the phase sequence from `docs/IMPLEMENTATION_LOG.md`.

## 5. RBAC roles

§4 lists "Listener" and "Supporter" as user types, but Supporter is explicitly defined as _derived_ ("a listener with one or more active artist-support relationships"), not an assignable role. Assumption: `user_roles` only stores roles that require explicit grant — `admin`, `curator` — plus per-artist scoped roles in `artist_members` (`owner`, `manager`, `a_r`, `marketing`, `content_editor`, `finance_viewer`). Listener/Supporter status is computed from existence of rows elsewhere (positions, future support_subscriptions), not stored as a role.

## 6. No real Coinbase Commerce credentials

Payments remain in the same state as before this pass: `COMMERCE_API_KEY`/`COMMERCE_WEBHOOK_SECRET` are not configured (real business account setup is outside what an agent can do), and Edge Function deployment is pending manual tool approval. Both are called out again in `docs/DEPLOYMENT.md` rather than silently left unmentioned.

## 7. Benefit/BenefitEntitlement collapsed into `support_tiers.benefits`

§19's data model lists `Benefit` and `BenefitEntitlement` as separate entities. There is no gated content yet (no community posts, no drops) that would need to check "does this specific user have this specific benefit" — the only thing that currently matters is "does this user have an active subscription to a tier that lists this benefit," which is fully answerable from `support_subscriptions.status` + `support_tiers.benefits` with no extra table.

**Assumption**: model benefits as a plain JSON text array on `support_tiers` for now, and treat "entitled" as synonymous with "has an active subscription to a tier listing that benefit," rather than building relational plumbing with zero current consumers.

**If wrong / when this breaks down**: the moment a benefit needs individual tracking (e.g. "redeemed" merch credit, a benefit that outlives a canceled subscription, or per-user overrides), split it into real `benefits` + `benefit_entitlements` tables — straightforward migration, no data loss, since the tier's benefit list is still the source of truth for what to migrate.

## 8. No real recurring billing

`support_tiers.billing_frequency = 'monthly'` and `support_subscriptions.current_period_end` exist, but nothing auto-charges when a period ends — Coinbase Commerce's hosted checkout has no stored-payment-method mechanism to charge later without the supporter present. `record_support_payment_confirmed` only extends `current_period_end` when a _new_ checkout is completed and confirmed.

**Assumption**: this is fine to ship as "monthly" tiers that require the supporter to manually complete a fresh checkout each period, as long as the UI is honest about it — not fine to silently imply auto-renewal exists. **Not yet built**: a renew prompt/reminder when `current_period_end` has passed (currently a lapsed monthly subscription just sits with a stale `current_period_end` and no visible nudge) — flagged as a gap, not hidden.

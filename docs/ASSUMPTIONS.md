# Assumptions

Recorded per the master prompt's §1.6 requirement. Each entry states the assumption, why it was necessary, and what would change it.

## 1. `regulatedOfferings` = the bonding-curve trading system already built

Earlier in this session (before the master prompt was given), the user asked to "copy Pauv's buy and sell structure" — a prediction-market-style continuous bonding curve with Buy (positive)/Sell (negative) positions, escrow-backed shorts, and instant settlement against an internal wallet. That system (`artist_curves`, `wallets`, `wallet_deposits`, `positions`, `open_position`/`close_position`) was fully designed and deployed to the database before this master prompt arrived.

The master prompt's §11 then describes almost exactly that mechanic — "a cultural stock exchange without presenting regulated securities," continuously priced, tradable — and explicitly requires it to live in a separate `regulatedOfferings` domain that is **disabled by default and inaccessible unless explicitly configured**, distinct from the default `supportSubscriptions`/`supportPayments`/`benefitEntitlements` flow.

**Assumption**: rather than discard the trading system, it _is_ the `regulatedOfferings` module. This pass adds a `feature_flags` row (`regulated_offerings`, default `false`) and will gate the trading UI behind it.

**Update (superseding the rest of this entry)**: a tiered/subscription default flow was subsequently built (`support_tiers`/`support_subscriptions`/`support_payments`) per §9/§11, then explicitly reversed by the founder — see #7. The bonding-curve trading system is now the **only** backing mechanism, still gated behind `regulated_offerings` (default `false`); deposit/withdraw is its funding/cashout layer, not a separate flow. **`regulated_offerings` is still `false`** — flipping it is the one remaining step to make backing visible/usable at all, and per `docs/DEPLOYMENT.md` that's a deliberate go/no-go the founder should make, not something to flip silently.

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

## 7. Tiered/subscription model built, then explicitly reversed by the founder

A default tiered support flow (`support_tiers`/`support_subscriptions`/`support_payments`, following §9/§11's spec — see the original #7/#8 reasoning below, kept for the record) was built, then the founder explicitly overrode it: "We're not doing subs we're doing deposit and withdraws." All three tables were dropped (they held no real user data — only fictional seed rows) and the `support-artist` Edge Function removed.

**Current state**: the bonding-curve trading system (Assumption #1) is the sole backing mechanism. There is no tiered/benefits model and no recurring billing of any kind. Deposit and withdraw (both against `wallets.balance_cents`) are the wallet's funding/cashout layer around that trading system, not a separate product surface.

Original reasoning, kept for context on why the tier model looked like a good idea at the time — no longer applicable, superseded by the founder's direction above:

> §19's data model lists `Benefit` and `BenefitEntitlement` as separate entities. There was no gated content that would need to check "does this specific user have this specific benefit" — the only thing that mattered was "does this user have an active subscription to a tier that lists this benefit," answerable from `support_subscriptions.status` + `support_tiers.benefits` with no extra table. And: `support_tiers.billing_frequency = 'monthly'` tracked a period but nothing auto-charged when it ended, since Coinbase Commerce has no stored-payment-method mechanism — "monthly" tiers would have required a manual fresh checkout each period.

## 8. Withdrawals are requests, not instant payouts

Coinbase Commerce only accepts payments — it has no API for sending crypto out. `request_withdrawal` debits the wallet immediately (so a balance can't be withdrawn twice) and records a `pending` row in `withdrawal_requests`; actually sending the funds and marking the request `paid` is a manual step outside the app, until a real payout provider is integrated.

**Assumption**: this is honest and complete as far as the app's own state goes (the request is real, the debit is real, canceling correctly refunds) — the gap is entirely on the "someone/something needs to actually send the crypto" side, which is operational, not a missing feature to fake. Flagged in `docs/DEPLOYMENT.md` alongside the other manual steps (Coinbase Commerce account setup, Edge Function deployment).

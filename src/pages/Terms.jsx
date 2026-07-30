import { Link } from "react-router-dom";
import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function Terms() {
  usePageTitle("Terms of Service — Nextup");

  return (
    <main>
      <Breadcrumb />

      <section style={{ borderBottom: "none" }}>
        <div className="wrap content-page">
          <div className="eyebrow">Legal</div>
          <h1
            style={{
              fontSize: "clamp(30px, 4.4vw, 44px)",
              margin: "16px 0 8px",
            }}
          >
            Terms of Service
          </h1>
          <div className="updated">
            Draft — last updated 2026. Pre-launch document; not yet reviewed by
            counsel. Nextup is not open to the public yet.
          </div>

          <h2>1. What Nextup is</h2>
          <p>
            Nextup is a platform for discovering unsigned and rising artists. It
            offers two ways to participate: buying permanent ownership of a
            specific track at a flat price ("Song Ownership"), and opening
            Buy/Sell positions against an artist's live, continuously-priced
            bonding curve using funds held in a Nextup wallet ("Backing"). All
            payments are in cryptocurrency via Coinbase Commerce — Nextup does
            not accept cards or bank transfers.
          </p>

          <h2>2. Eligibility</h2>
          <p>
            You must be able to form a binding contract in your jurisdiction and
            be legally permitted to hold and transact in cryptocurrency where
            you live. Nextup does not verify identity or residency beyond a
            valid email address at this time; you're responsible for confirming
            your own local regulations allow you to use the platform, including
            the Backing feature described below.
          </p>

          <h2>3. Accounts</h2>
          <p>
            Accounts are created via email magic-link — there are no passwords.
            You're responsible for keeping access to your email account secure,
            since it is the sole means of authenticating to Nextup.
          </p>

          <h2>4. Song Ownership</h2>
          <p>
            Each track has a single, flat, one-time price set by the artist.
            Payment is a Coinbase Commerce crypto charge. Once confirmed
            on-chain, ownership of that track is recorded to your account
            permanently. Each track can only be owned by one account at a time.
            Song Ownership purchases are final once the charge confirms — see
            Section 7 on refunds.
          </p>

          <h2>5. Backing, wallets, and trading</h2>
          <p>
            Backing is funded through a Nextup wallet balance, added via
            Coinbase Commerce (minimum $10 per deposit). From that balance you
            may open a Buy ("positive") or Sell ("negative") position against an
            artist's bonding-curve price (minimum $1 stake). Sell positions are
            backed by escrow held from your wallet at up to twice your stake;
            Nextup does not extend margin or credit, and there are no margin
            calls beyond the escrow already held. Closing a position settles at
            the then-current curve price and credits or debits your wallet
            accordingly.
          </p>

          <h2>6. Withdrawals</h2>
          <p>
            You may request a withdrawal of your wallet balance (minimum $10) to
            a cryptocurrency address you provide. A withdrawal request debits
            your wallet immediately and is fulfilled by Nextup shortly after —
            it is a request, not an instant automated payout. You may cancel a
            request while it remains pending for an immediate refund to your
            wallet balance. You are solely responsible for providing a correct
            destination address; Nextup cannot reverse a payment sent to an
            address you supplied.
          </p>

          <h2>7. Payments are final</h2>
          <p>
            Cryptocurrency payments cannot be reversed once confirmed on-chain.
            Nextup does not offer refunds for Song Ownership purchases, wallet
            deposits, or closed positions, except where required by law. If a
            payment fails to confirm, no charge is recorded and no funds move.
          </p>

          <h2>8. Risk</h2>
          <p>
            Backing an artist and owning a song both carry financial risk,
            including possible loss of your full contribution and exposure to
            cryptocurrency price volatility. Read the full{" "}
            <Link to="/risk-disclosure">risk disclosure</Link> before using
            either feature — it is part of these Terms by reference.
          </p>

          <h2>9. Artist content and conduct</h2>
          <p>
            Artists are responsible for the accuracy of their profile, track
            metadata, and pricing, and for having the rights to any content they
            upload. Nextup may remove content or suspend an account that
            infringes rights, is fraudulent, or otherwise violates these Terms.
          </p>

          <h2>10. Changes</h2>
          <p>
            Nextup is pre-launch and these Terms will change as the product
            does. Material changes will be reflected on this page with an
            updated date above.
          </p>

          <h2>11. Contact</h2>
          <p>
            Questions about these Terms:{" "}
            <a href="mailto:admin@nextup.exchange">admin@nextup.exchange</a>.
          </p>
        </div>
      </section>
    </main>
  );
}

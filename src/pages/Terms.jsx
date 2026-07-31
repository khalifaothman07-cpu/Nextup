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
            Approved by Nextup for pre-launch, 31 July 2026. Not reviewed by
            outside counsel. Nextup is not open to the public yet.
          </div>

          <h2>1. What Nextup is</h2>
          <p>
            A platform for discovering unsigned and rising artists, with two
            ways to take part: buying permanent ownership of a track at a flat
            price ("Song Ownership"), and opening Buy/Sell positions against an
            artist's live bonding-curve price from a Nextup wallet ("Backing").
            Payment is cryptocurrency via Coinbase Commerce only — no cards, no
            bank transfers.
          </p>

          <h2>2. Eligibility</h2>
          <p>
            You must be able to form a binding contract where you live, and be
            legally permitted to hold and transact in cryptocurrency there. We
            verify nothing beyond a working email address, so confirming your
            local rules allow this — Backing included — is on you.
          </p>

          <h2>3. Accounts</h2>
          <p>
            Sign-in is an emailed magic link; there are no passwords. Your email
            account is therefore the only thing standing between someone else
            and your account. Keep it secure.
          </p>

          <h2>4. Song Ownership</h2>
          <p>
            One flat price per track, set by the artist, paid as a Coinbase
            Commerce crypto charge. Once it confirms on-chain the track is
            recorded to your account permanently, and only one account can own a
            given track at a time. Purchases are final once the charge confirms
            — see Section 7.
          </p>

          <h2>5. Backing, wallets, and trading</h2>
          <p>
            Fund a Nextup wallet via Coinbase Commerce ($10 minimum deposit),
            then open Buy or Sell positions against an artist's curve price ($1
            minimum stake). Sell positions are backed by escrow of up to twice
            your stake — we extend no margin or credit, and there are no margin
            calls beyond that escrow. Closing settles at the current curve price
            and credits or debits your wallet.
          </p>

          <h2>6. Withdrawals</h2>
          <p>
            You may request a withdrawal ($10 minimum) to a crypto address you
            provide. The request debits your wallet immediately and is fulfilled
            by us shortly after — a request, not an instant automated payout.
            Cancel while it is still pending for an immediate refund to your
            wallet balance. You are solely responsible for providing a correct
            destination address; Nextup cannot reverse a payment sent to an
            address you supplied.
          </p>

          <h2>7. Payments are final</h2>
          <p>
            Crypto payments cannot be reversed once confirmed on-chain. No
            refunds on Song Ownership purchases, wallet deposits, or closed
            positions, except where the law requires it. If a payment never
            confirms, nothing is recorded and no funds move.
          </p>

          <h2>8. Risk</h2>
          <p>
            Backing an artist and owning a song both carry financial risk,
            including losing everything you put in and exposure to crypto price
            swings. Read the full{" "}
            <Link to="/risk-disclosure">risk disclosure</Link> before using
            either feature — it is part of these Terms by reference.
          </p>

          <h2>9. Artist content and conduct</h2>
          <p>
            Artists are responsible for their profile, track metadata and
            pricing being accurate, and for holding the rights to anything they
            upload. We may remove content or suspend an account that infringes
            rights, is fraudulent, or breaks these Terms.
          </p>

          <h2>10. Changes</h2>
          <p>
            Nextup is pre-launch and these Terms will change as it does.
            Material changes appear here with a new date above.
          </p>

          <h2>11. Contact</h2>
          <p>
            <a href="mailto:admin@nextup.exchange">admin@nextup.exchange</a>
          </p>
        </div>
      </section>
    </main>
  );
}

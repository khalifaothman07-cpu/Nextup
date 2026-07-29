import { Link } from "react-router-dom";
import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { PageHero } from "../components/PageHero.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function Faq() {
  usePageTitle("FAQ — Nextup");
  useReveal();

  return (
    <main>
      <Breadcrumb />

      <PageHero eyebrow="Questions" title="Before you ask." />

      <section style={{ borderBottom: "none" }}>
        <div className="wrap">
          <div className="faq" data-reveal>
            <details>
              <summary>What does "backing" an artist actually get me?</summary>
              <div className="faq-a">
                A position tied to that artist's career as a whole — not one
                release. You fund your wallet, then open a Buy or Sell position
                against the artist's live bonding-curve price. As their
                catalogue and audience grow, your position is tied to that
                growth. You also show up on their page as an early backer. See{" "}
                <Link to="/pricing">pricing</Link> for the mechanics.
              </div>
            </details>
            <details>
              <summary>
                How is owning a song different from backing an artist?
              </summary>
              <div className="faq-a">
                Backing is tied to the artist's whole future and priced live on
                their curve. Owning a song is tied to one specific track at a
                flat, one-time price — it's yours permanently, whether or not
                the artist ever releases anything else.
              </div>
            </details>
            <details>
              <summary>How do deposits and withdrawals work?</summary>
              <div className="faq-a">
                Adding funds creates a Coinbase Commerce crypto charge; once it
                confirms, the amount lands in your Nextup wallet balance.
                Withdrawing is a request, not an instant payout — it debits your
                wallet right away and is fulfilled to your destination address
                shortly after. You can cancel a still-pending request for an
                instant refund back to your wallet balance.
              </div>
            </details>
            <details>
              <summary>Is this investment advice?</summary>
              <div className="faq-a">
                No. Backing an artist or owning a song carries real financial
                risk, including possible loss of your full contribution and
                exposure to cryptocurrency price volatility. Nothing on this
                site is investment advice or a solicitation. See the{" "}
                <Link to="/risk-disclosure">risk disclosure</Link> for the full
                picture.
              </div>
            </details>
            <details>
              <summary>Where is Nextup available?</summary>
              <div className="faq-a">
                Nextup is available worldwide — there's no regional rollout.
                Because payments are crypto-only, you'll need a crypto wallet or
                an exchange account to fund one; local regulations around crypto
                payments may still affect eligibility depending on where you
                live.
              </div>
            </details>
            <details>
              <summary>What crypto do you accept?</summary>
              <div className="faq-a">
                BTC, ETH, USDC, and more, at checkout. Nextup doesn't accept
                cards or bank transfers — every backing and song purchase
                settles in crypto.
              </div>
            </details>
            <details>
              <summary>How do I get on the platform as an artist?</summary>
              <div className="faq-a">
                Artist onboarding isn't open yet — join the waitlist and note
                that you're an artist when we reach out.
              </div>
            </details>
          </div>
        </div>
      </section>
    </main>
  );
}

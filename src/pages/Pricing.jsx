import { Link } from "react-router-dom";
import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { PageHero } from "../components/PageHero.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function Pricing() {
  usePageTitle("Pricing — Nextup");
  useReveal();

  return (
    <main>
      <Breadcrumb />

      <PageHero eyebrow="Pricing" title="No tiers. Two honest ways to pay.">
        <p>
          Priced in USD, paid in crypto. No platform fee — you pay the price
          shown, plus whatever the network costs.
        </p>
      </PageHero>

      <section>
        <div className="wrap">
          <div className="sides" data-reveal>
            <div className="side b">
              <div className="letter">SIDE B</div>
              <h3>Own the Song</h3>
              <p>
                One flat price per track, set by the artist — typically{" "}
                <strong style={{ color: "var(--text)" }}>$34–$59</strong>. Pay
                once and the track is yours, whether or not they ever release
                another.
              </p>
              <ul>
                <li>No bidding, no subscription</li>
                <li>Price shown on the artist's profile before you buy</li>
              </ul>
            </div>
            <div className="side a">
              <div className="letter">SIDE A</div>
              <h3>Back the Artist</h3>
              <p>
                No tiers. Fund a wallet, then trade Buy/Sell positions against
                the artist's live price, which moves with real demand.
              </p>
              <ul>
                <li>The curve sets the price, not us</li>
                <li>Sell positions are escrow-backed — no margin calls</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">Wallet minimums</div>
            <h2>The only fixed numbers.</h2>
            <p>Floors that stop network fees eating the transaction.</p>
          </div>
          <div className="tiers" data-reveal>
            <div className="tier">
              <div className="tk">WALLET</div>
              <div className="amount">
                $10<span>minimum</span>
              </div>
              <p>Add funds</p>
            </div>
            <div className="tier featured">
              <div className="tk">TRADE</div>
              <div className="amount">
                $1<span>minimum</span>
              </div>
              <p>Open a position</p>
            </div>
            <div className="tier">
              <div className="tk">WITHDRAW</div>
              <div className="amount">
                $10<span>minimum</span>
              </div>
              <p>Cash out</p>
            </div>
          </div>
          <div className="tiers-note">
            Withdrawals are requests, not instant payouts. Cancel a pending one
            for an immediate refund. <Link to="/faq">FAQ</Link> ·{" "}
            <Link to="/risk-disclosure">Risk disclosure</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

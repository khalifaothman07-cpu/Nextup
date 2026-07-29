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
          Priced in USD, paid entirely in crypto — BTC, ETH, USDC, and more. No
          cards, no bank transfers. Nextup doesn't charge a platform fee on
          either path below; you only pay the price shown at checkout, plus
          whatever network cost the crypto payment itself involves.
        </p>
      </PageHero>

      <section>
        <div className="wrap">
          <div className="sides" data-reveal>
            <div className="side b">
              <div className="letter">SIDE B</div>
              <h3>Own the Song</h3>
              <p>
                A flat, one-time price per track, set by the artist — typically{" "}
                <strong style={{ color: "var(--paper)" }}>$34–$59</strong>. Pay
                once at checkout and the track is yours, permanently and
                provably, whether or not the artist ever releases another one.
              </p>
              <ul>
                <li>One price per track — no bidding, no subscription</li>
                <li>
                  Set individually by each artist, shown on their profile before
                  you buy
                </li>
                <li>Settles via a single Coinbase Commerce charge</li>
              </ul>
            </div>
            <div className="side a">
              <div className="letter">SIDE A</div>
              <h3>Back the Artist</h3>
              <p>
                There's no fixed tier or minimum "backing amount." You fund a
                Nextup wallet, then trade Buy/Sell positions against the
                artist's live, continuously-priced bonding curve — the price
                moves with real trading, the same way the artist's momentum
                does.
              </p>
              <ul>
                <li>No fixed price points — the curve sets the price live</li>
                <li>Open or close a position any time the market's open</li>
                <li>
                  Short positions are escrow-backed — no margin calls beyond
                  your escrow
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">Wallet minimums</div>
            <h2>The only numbers that are actually fixed.</h2>
            <p>
              Everything above is priced live or set by the artist — these three
              are the only hard floors in the system, and they exist to keep
              crypto network costs from swallowing tiny transactions.
            </p>
          </div>
          <div className="tiers" data-reveal>
            <div className="tier">
              <div className="tk">WALLET</div>
              <div className="amount">
                $10<span>minimum</span>
              </div>
              <p>Add funds</p>
              <ul>
                <li>
                  Smallest deposit into your Nextup wallet, via Coinbase
                  Commerce
                </li>
              </ul>
            </div>
            <div className="tier featured">
              <div className="tk">TRADE</div>
              <div className="amount">
                $1<span>minimum</span>
              </div>
              <p>Open a position</p>
              <ul>
                <li>
                  Smallest stake to open a Buy or Sell position on an artist's
                  curve
                </li>
              </ul>
            </div>
            <div className="tier">
              <div className="tk">WITHDRAW</div>
              <div className="amount">
                $10<span>minimum</span>
              </div>
              <p>Cash out</p>
              <ul>
                <li>Smallest withdrawal request from your wallet balance</li>
              </ul>
            </div>
          </div>
          <div className="tiers-note">
            Withdrawals are requests, not instant payouts — a request debits
            your wallet immediately and is fulfilled by Nextup shortly after;
            you can cancel a still-pending request for an instant refund to your
            wallet. See the <Link to="/faq">FAQ</Link> and{" "}
            <Link to="/risk-disclosure">risk disclosure</Link> for details.
          </div>
        </div>
      </section>
    </main>
  );
}

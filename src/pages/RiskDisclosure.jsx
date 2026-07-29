import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function RiskDisclosure() {
  usePageTitle("Risk Disclosure — Nextup");

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
            Risk Disclosure
          </h1>
          <div className="updated">
            Draft — last updated 2026. Pre-launch document; not yet reviewed by
            counsel. Read this in full before backing an artist or owning a
            song.
          </div>

          <h2>Not investment advice</h2>
          <p>
            Nothing on Nextup is investment advice, a recommendation, or a
            solicitation to buy or sell anything. Backing an artist and owning a
            song are both discretionary purchases you make with your own
            judgment. Nextup does not guarantee any outcome, return, or level of
            artist success.
          </p>

          <h2>You can lose your full contribution</h2>
          <p>
            An artist's momentum can decline. A bonding-curve position can be
            closed for less than you paid to open it, including a total loss of
            the stake behind it. A track you own has no guaranteed resale value.
            There is no insurance, guarantee fund, or protection scheme behind
            any balance, position, or purchase on Nextup.
          </p>

          <h2>Cryptocurrency volatility</h2>
          <p>
            All payments, wallet balances, and prices on Nextup are denominated
            in USD but settled in cryptocurrency. Crypto asset prices are
            volatile; the value of what you send or receive can change
            significantly between the moment you initiate a payment and the
            moment it confirms on-chain.
          </p>

          <h2>How the bonding curve works — and what that means for you</h2>
          <p>
            An artist's price moves continuously with trading activity:{" "}
            <code>price(supply) = base_price × e^(k × supply)</code>. Opening a
            position changes the price for the next person. A Sell ("negative")
            position is backed by escrow of up to twice your stake rather than
            open-ended margin, but the position can still be closed for a loss
            up to that escrowed amount. Curve depth can limit how large a Sell
            position can be at any given time — this is a deliberate safeguard,
            not a bug, but it means you may not always be able to open the exact
            position size you want.
          </p>

          <h2>Payments are final</h2>
          <p>
            Cryptocurrency payments cannot be reversed once confirmed on-chain.
            There are no refunds for Song Ownership purchases, wallet deposits,
            or closed positions except where required by law.
          </p>

          <h2>Withdrawals are manual, not instant</h2>
          <p>
            A withdrawal request debits your wallet immediately but is fulfilled
            by Nextup as a manual step shortly after, not an automated on-demand
            payout. If you provide an incorrect destination address, the funds
            cannot be recovered.
          </p>

          <h2>Regulatory and jurisdictional risk</h2>
          <p>
            Rules around cryptocurrency payments and artist-backing products
            vary by jurisdiction and can change. You are responsible for
            confirming that using Nextup, and specifically the Backing feature,
            is lawful where you live before you use it.
          </p>

          <h2>No professional advice</h2>
          <p>
            Nextup doesn't provide legal, tax, or financial advice. Consider
            speaking with a qualified professional about the tax and legal
            implications of backing an artist or owning a song before you do
            either.
          </p>
        </div>
      </section>
    </main>
  );
}

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
            Nothing here is investment advice, a recommendation, or a
            solicitation. Backing an artist and owning a song are discretionary
            purchases you make on your own judgment. We guarantee no outcome, no
            return, and no level of artist success.
          </p>

          <h2>You can lose your full contribution</h2>
          <p>
            An artist's momentum can decline. A position can close for less than
            you paid to open it, up to losing the whole stake. A track you own
            has no guaranteed resale value. There is no insurance, no guarantee
            fund, and no protection scheme behind any balance, position or
            purchase here.
          </p>

          <h2>Cryptocurrency volatility</h2>
          <p>
            Everything is priced in USD but settled in crypto, and crypto is
            volatile. What you send or receive can change in value between
            starting a payment and it confirming on-chain.
          </p>

          <h2>How the price moves</h2>
          <p>
            The price rises as people buy and falls as they sell — your own
            position moves it for whoever comes next. A Sell position is backed
            by escrow of up to twice your stake instead of open-ended margin,
            and can still close at a loss up to that escrowed amount. How much
            the curve can absorb limits how large a Sell can be at any moment;
            that is a deliberate safeguard, but it means the size you want may
            not always be available.
          </p>
          <p className="legal-formula">
            <code>price(supply) = base_price × e^(k × supply)</code>
          </p>

          <h2>Payments are final</h2>
          <p>
            Crypto payments cannot be reversed once confirmed on-chain. No
            refunds on purchases, deposits or closed positions, except where the
            law requires it.
          </p>

          <h2>Withdrawals are manual, not instant</h2>
          <p>
            A withdrawal debits your wallet immediately but is paid out by hand
            shortly after, not automatically on demand.{" "}
            <strong>
              Send it to the wrong address and the funds cannot be recovered.
            </strong>
          </p>

          <h2>Regulatory and jurisdictional risk</h2>
          <p>
            Rules on crypto payments and artist-backing products vary by country
            and change. Confirming that Nextup — Backing especially — is lawful
            where you live is your responsibility, before you use it.
          </p>

          <h2>No professional advice</h2>
          <p>
            We don't give legal, tax or financial advice. Talk to someone
            qualified about the tax and legal side before you back an artist or
            buy a song.
          </p>
        </div>
      </section>
    </main>
  );
}

import { Link } from "react-router-dom";
import { Logo } from "./Logo.jsx";

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-top">
          <Link to="/#top" className="mark">
            <Logo />
            <span>Nextup</span>
          </Link>
          <div className="foot-links">
            <div className="foot-col">
              <h5>PRODUCT</h5>
              <Link to="/how-it-works">How it works</Link>
              <Link to="/pricing">Pricing</Link>
              <Link to="/discover">Discover artists</Link>
              <Link to="/#waitlist">Early access</Link>
            </div>
            <div className="foot-col">
              <h5>COMPANY</h5>
              <Link to="/about">About</Link>
              <Link to="/faq">FAQ</Link>
              <Link to="/press">Press</Link>
            </div>
            <div className="foot-col">
              <h5>LEGAL</h5>
              <Link to="/terms">Terms</Link>
              <Link to="/risk-disclosure">Risk disclosure</Link>
              <Link to="/privacy">Privacy</Link>
            </div>
          </div>
        </div>
        <div className="foot-bottom">
          <div className="legal">
            Nextup involves financial risk, including possible loss of your full
            contribution and exposure to cryptocurrency price volatility.
            Nothing on this page is investment advice or a solicitation.
            Payments are crypto-only and final. Eligibility may vary based on
            local regulations around crypto payments.
          </div>
          <div className="copy">© 2026 NEXTUP</div>
        </div>
      </div>
    </footer>
  );
}

import { Link } from "react-router-dom";
import { Logo } from "./Logo.jsx";
import { AuthWidget } from "./AuthWidget.jsx";

export function Header() {
  return (
    <header>
      <nav className="wrap">
        <Link to="/#top" className="mark">
          <Logo />
          <span>Nextup</span>
        </Link>
        <div className="nav-right">
          <Link to="/discover" className="nav-link">
            Discover
          </Link>
          <div className="auth-widget">
            <AuthWidget />
          </div>
          <Link to="/#waitlist" className="nav-cta">
            Get Early Access
          </Link>
        </div>
      </nav>
    </header>
  );
}

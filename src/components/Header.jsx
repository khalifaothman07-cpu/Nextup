import { Link } from "react-router-dom";
import { Logo } from "./Logo.jsx";
import { AuthWidget } from "./AuthWidget.jsx";
import { useSession } from "../context/SessionContext.jsx";
import { useMemberships } from "../hooks/useMemberships.js";

export function Header() {
  const { session } = useSession();
  const memberships = useMemberships();

  return (
    <header>
      <nav className="wrap">
        <Link to="/#top" className="mark">
          <Logo />
          <span>Nextup</span>
        </Link>

        <div className="nav-links">
          <Link to="/discover" className="nav-link">
            Discover
          </Link>
          {session && (
            <Link to="/account" className="nav-link">
              Account
            </Link>
          )}
          {session && memberships?.length > 0 && (
            <Link to="/dashboard" className="nav-link">
              Dashboard
            </Link>
          )}
        </div>

        <div className="nav-right">
          <div className="auth-widget">
            <AuthWidget />
          </div>
          {/* Nothing to offer someone who already has an account. */}
          {!session && (
            <Link to="/#waitlist" className="nav-cta">
              Get Early Access
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

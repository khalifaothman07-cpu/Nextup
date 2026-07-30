import { Link } from "react-router-dom";
import { Logo } from "./Logo.jsx";
import { AuthWidget } from "./AuthWidget.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import { WhoAmI } from "./WhoAmI.jsx";
import { useSession } from "../context/SessionContext.jsx";
import { useMemberships } from "../hooks/useMemberships.js";
import { useRoles } from "../hooks/useRoles.js";

export function Header() {
  const { session } = useSession();
  const memberships = useMemberships();
  const roles = useRoles();

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
          {session && roles?.includes("admin") && (
            <Link to="/admin" className="nav-link is-admin">
              Admin
            </Link>
          )}
        </div>

        <div className="nav-right">
          {session && <WhoAmI roles={roles} memberships={memberships} />}
          <div className="auth-widget">
            <AuthWidget />
          </div>
          <ThemeToggle />
          {/* Nothing to offer someone who already has an account. */}
          {!session && (
            <Link to="/#waitlist" className="nav-cta">
              Get early access
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

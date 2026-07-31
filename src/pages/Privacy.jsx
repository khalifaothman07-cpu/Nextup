import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function Privacy() {
  usePageTitle("Privacy Policy — Nextup");

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
            Privacy Policy
          </h1>
          <div className="updated">
            Draft — last updated 2026. Pre-launch document; not yet reviewed by
            counsel.
          </div>

          <h2>What we collect</h2>
          <dl className="legal-dl">
            <dt>Email</dt>
            <dd>For magic-link sign-in. There is no password to store.</dd>
            <dt>Waitlist email</dt>
            <dd>If you join the waitlist.</dd>
            <dt>Platform activity</dt>
            <dd>
              Songs you own, wallet balance, deposits, withdrawals, positions.
              Account data, not tracking.
            </dd>
            <dt>Withdrawal address</dt>
            <dd>The crypto address you give us, so we can pay you.</dd>
          </dl>
          <p>
            <strong>Not collected:</strong> no analytics, no ad trackers, no
            tracking cookies, no card or bank details — payments go through
            Coinbase Commerce.
          </p>

          <h2>Who processes it</h2>
          <p>
            Your data lives in Supabase (Postgres) under row-level security, so
            you can only read your own records. Payments run through Coinbase
            Commerce — we get confirmation that a charge cleared, never your
            wallet credentials.
          </p>

          <h2>How we use it</h2>
          <p>
            To run your account, settle the payments and withdrawals you start,
            price the curve correctly, and email you about any of it. We don't
            sell it or share it with advertisers.
          </p>

          <h2>Retention</h2>
          <p>
            As long as your account is active, plus whatever we need to settle
            disputes, meet legal obligations, and keep accurate financial
            records.
          </p>

          <h2>Your choices</h2>
          <p>
            Email us for a copy of your data or to delete your account. Deletion
            can be limited where we're required to keep transaction records.
          </p>

          <h2>Contact</h2>
          <p>
            <a href="mailto:admin@nextup.exchange">admin@nextup.exchange</a>
          </p>
        </div>
      </section>
    </main>
  );
}

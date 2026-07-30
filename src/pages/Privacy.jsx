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
          <p>
            <strong>Account &amp; auth:</strong> your email address, used solely
            for magic-link sign-in — Nextup never stores a password.
          </p>
          <p>
            <strong>Waitlist:</strong> if you join the waitlist, we store the
            email address you submit.
          </p>
          <p>
            <strong>Activity on the platform:</strong> song ownership purchases,
            wallet balance and deposit/withdrawal history, and backing positions
            you open or close — this is core account data, not optional
            tracking.
          </p>
          <p>
            <strong>Withdrawal destination addresses:</strong> the
            cryptocurrency address you provide when requesting a withdrawal,
            stored so the request can be fulfilled.
          </p>
          <p>
            <strong>What we don't collect:</strong> Nextup does not use
            analytics or advertising trackers, and does not set tracking
            cookies. We don't collect payment card or bank details — all
            payments go through Coinbase Commerce directly.
          </p>

          <h2>Who processes it</h2>
          <p>
            Account data, wallet balances, and platform activity are stored in
            Supabase (Postgres), access-controlled with row-level security so
            you can only read your own records. Payments are processed by
            Coinbase Commerce, which handles the cryptocurrency charge itself —
            Nextup receives confirmation of a charge, not any wallet
            credentials.
          </p>

          <h2>How we use it</h2>
          <p>
            To operate your account, process the payments and withdrawals you
            initiate, run the bonding-curve trading system correctly, and
            contact you about your account, the waitlist, or the platform. We
            don't sell your data or share it with advertisers.
          </p>

          <h2>Retention</h2>
          <p>
            We keep account and transaction records for as long as your account
            is active and as needed to resolve disputes, comply with legal
            obligations, or maintain accurate financial records.
          </p>

          <h2>Your choices</h2>
          <p>
            You can request a copy of your data or ask us to delete your account
            by emailing us below. Deletion may be limited where we need to
            retain transaction records for legal or accounting reasons.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this policy or your data:{" "}
            <a href="mailto:admin@nextup.exchange">admin@nextup.exchange</a>.
          </p>
        </div>
      </section>
    </main>
  );
}

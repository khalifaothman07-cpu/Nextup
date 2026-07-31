import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { formatUSD } from "../lib/format.js";
import { useSession } from "../context/SessionContext.jsx";
import { useRoles } from "../hooks/useRoles.js";
import { PageHero } from "../components/PageHero.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

const STATUSES = ["pending", "reviewing", "accepted", "declined"];

const QUEUES = [
  { key: "open", label: "Needs a decision", match: ["pending", "reviewing"] },
  { key: "accepted", label: "Accepted", match: ["accepted"] },
  { key: "declined", label: "Declined", match: ["declined"] },
];

function when(ts) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Admin() {
  usePageTitle("Admin console — Nextup");
  const { session, loading } = useSession();
  const roles = useRoles();
  const isAdmin = roles?.includes("admin");

  const [applications, setApplications] = useState(null);
  const [flags, setFlags] = useState([]);
  const [audit, setAudit] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [txRefs, setTxRefs] = useState({});
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [queue, setQueue] = useState("open");
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    if (!isAdmin) return;
    const [apps, flagRows, auditRows, wdRows] = await Promise.all([
      supabase.rpc("admin_list_applications"),
      supabase
        .from("feature_flags")
        .select("key, enabled, description, updated_at")
        .order("key"),
      supabase.rpc("admin_list_audit", { p_limit: 50 }),
      supabase.rpc("admin_list_withdrawals", { p_limit: 100 }),
    ]);
    const list = apps.data ?? [];
    setApplications(list);
    // Seed each notes box from what's already stored, so editing one doesn't
    // silently blank a note somebody else wrote.
    setNotes(Object.fromEntries(list.map((a) => [a.id, a.review_notes ?? ""])));
    setFlags(flagRows.data ?? []);
    setAudit(auditRows.data ?? []);
    setWithdrawals(wdRows.data ?? []);
    setTxRefs({});
    setRejecting(null);
    setRejectReason("");
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useReveal([applications, queue]);

  async function review(app, nextStatus) {
    setBusy(app.id);
    setStatus("");
    const { error } = await supabase.rpc("admin_review_application", {
      p_application_id: app.id,
      p_status: nextStatus,
      p_notes: notes[app.id] ?? "",
    });
    setBusy("");
    setStatus(
      error
        ? `Couldn't set ${app.artist_name} to ${nextStatus}: ${error.message}`
        : `${app.artist_name} → ${nextStatus}.`,
    );
    if (!error) await load();
  }

  async function onboard(app) {
    setBusy(app.id);
    setStatus("");
    const { data, error } = await supabase.rpc("admin_onboard_application", {
      p_application_id: app.id,
    });
    setBusy("");
    setStatus(
      error
        ? `Couldn't create the page: ${error.message}`
        : `Created /artist/${data?.slug} — ${app.artist_name} now owns it and has a dashboard.`,
    );
    if (!error) await load();
  }

  async function markPaid(w) {
    const ref = (txRefs[w.id] ?? "").trim();
    if (!ref) {
      setStatus(
        "Paste the transaction reference first — you shouldn't be able to record a payout without recording what you sent.",
      );
      return;
    }
    setBusy(w.id);
    setStatus("");
    const { error } = await supabase.rpc("admin_mark_withdrawal_paid", {
      p_request_id: w.id,
      p_tx_reference: ref,
    });
    setBusy("");
    setStatus(
      error
        ? `Couldn't mark it paid: ${error.message}`
        : `${formatUSD(w.amount_cents)} to ${w.payee_email} recorded as paid.`,
    );
    if (!error) await load();
  }

  async function reject(w) {
    setBusy(w.id);
    setStatus("");
    const { error } = await supabase.rpc("admin_reject_withdrawal", {
      p_request_id: w.id,
      p_reason: rejectReason.trim(),
    });
    setBusy("");
    setStatus(
      error
        ? `Couldn't reject it: ${error.message}`
        : `Rejected — ${formatUSD(w.amount_cents)} returned to ${w.payee_email}'s wallet.`,
    );
    if (!error) await load();
  }

  async function toggleFlag(flag) {
    setBusy(flag.key);
    setStatus("");
    const { error } = await supabase.rpc("admin_set_feature_flag", {
      p_key: flag.key,
      p_enabled: !flag.enabled,
    });
    setBusy("");
    setStatus(
      error
        ? `Couldn't change ${flag.key}: ${error.message}`
        : `${flag.key} is now ${flag.enabled ? "off" : "on"} for everyone.`,
    );
    if (!error) await load();
  }

  if (loading || roles === null) return <main />;

  if (!session) {
    return (
      <main>
        <PageHero
          eyebrow="Admin"
          title="Sign in to open the console."
          style={{ borderBottom: "none" }}
        >
          <p>Sign in above. The console is limited to admin accounts.</p>
        </PageHero>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main>
        <PageHero
          eyebrow="Admin"
          title="This account isn't an admin."
          style={{ borderBottom: "none" }}
        >
          <p>
            Admin is granted directly in the database, not applied for. If
            you're an artist looking for your own page, that's{" "}
            <Link to="/dashboard">the dashboard</Link>.
          </p>
        </PageHero>
      </main>
    );
  }

  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");
  const settledWithdrawals = withdrawals.filter((w) => w.status !== "pending");
  const owedCents = pendingWithdrawals.reduce(
    (sum, w) => sum + Number(w.amount_cents),
    0,
  );

  const visible = (applications ?? []).filter((a) =>
    QUEUES.find((q) => q.key === queue).match.includes(a.status),
  );
  const openCount = (applications ?? []).filter((a) =>
    ["pending", "reviewing"].includes(a.status),
  ).length;

  return (
    <main className="app-shell admin-shell">
      {/* The console gets its own chrome. You should never have to work out
          whether you are on the public site or in the back office. */}
      <div className="admin-band">
        <div className="wrap">
          <strong>Admin</strong>
          <span>{session.user.email}</span>
          <span className="spacer"></span>
          <span>Every action is audited</span>
          <Link to="/" className="nav-link">
            Leave console
          </Link>
        </div>
      </div>

      <PageHero eyebrow="Console" title="Run the place.">
        <p>
          {applications === null
            ? "Loading…"
            : openCount === 0
              ? "Nothing waiting on a decision."
              : `${openCount} application${openCount === 1 ? "" : "s"} waiting on a decision.`}
        </p>
      </PageHero>

      {/* Results belong where the eye already is. An admin pressing "Mark
          declined" halfway down the queue will not scroll to the footer to
          find out whether it worked, so the bar sticks to the top instead. */}
      {status && (
        <div className="admin-status" role="status">
          <div className="wrap">
            <span>{status}</span>
            <button type="button" onClick={() => setStatus("")}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <section>
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">Artist applications</div>
            <h2>The queue.</h2>
          </div>

          <div
            className="filter-chips"
            data-reveal
            style={{ marginBottom: 26 }}
          >
            {QUEUES.map((q) => (
              <button
                key={q.key}
                type="button"
                className={`filter-chip${q.key === queue ? " active" : ""}`}
                onClick={() => setQueue(q.key)}
              >
                {q.label} (
                {
                  (applications ?? []).filter((a) => q.match.includes(a.status))
                    .length
                }
                )
              </button>
            ))}
          </div>

          {applications === null && <p className="muted">Loading queue…</p>}

          {applications !== null && !visible.length && (
            <p className="muted">Nothing in this queue.</p>
          )}

          {visible.map((app) => (
            <article className="admin-card" data-reveal key={app.id}>
              <div className="admin-card-head">
                <div>
                  <h3>{app.artist_name}</h3>
                  <div className="admin-meta">
                    {app.genre} · {app.city} · applied {when(app.created_at)}
                  </div>
                </div>
                <span className={`status-pill ${app.status}`}>
                  {app.status}
                </span>
              </div>

              <dl className="admin-dl">
                <dt>Account</dt>
                <dd>
                  <a href={`mailto:${app.applicant_email}`}>
                    {app.applicant_email}
                  </a>
                  {app.applicant_display_name
                    ? ` · ${app.applicant_display_name}`
                    : ""}
                </dd>
                <dt>Links</dt>
                <dd className="apply-pre">{app.links}</dd>
                <dt>About</dt>
                <dd className="apply-pre">{app.about}</dd>
                {app.reviewed_at && (
                  <>
                    <dt>Reviewed</dt>
                    <dd>{when(app.reviewed_at)}</dd>
                  </>
                )}
                {app.onboarded_artist_slug && (
                  <>
                    <dt>Artist page</dt>
                    <dd>
                      <Link
                        to={`/artist/${encodeURIComponent(app.onboarded_artist_slug)}`}
                      >
                        /artist/{app.onboarded_artist_slug} →
                      </Link>
                    </dd>
                  </>
                )}
              </dl>

              <label className="dash-field admin-notes">
                <span>Review note (the applicant sees this)</span>
                <textarea
                  rows={2}
                  maxLength={600}
                  placeholder="Optional — saved with whichever status you set below."
                  value={notes[app.id] ?? ""}
                  onChange={(e) =>
                    setNotes({ ...notes, [app.id]: e.target.value })
                  }
                ></textarea>
              </label>

              <div className="admin-actions">
                {STATUSES.filter((s) => s !== app.status).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="filter-chip"
                    disabled={busy === app.id}
                    onClick={() => review(app, s)}
                  >
                    Mark {s}
                  </button>
                ))}
                {app.onboarded_artist_id ? (
                  <span className="admin-done">Artist page created</span>
                ) : (
                  <button
                    type="button"
                    className="back-btn admin-onboard"
                    disabled={busy === app.id}
                    onClick={() => onboard(app)}
                  >
                    Create artist page
                  </button>
                )}
              </div>
            </article>
          ))}

          <p className="results-note" data-reveal>
            "Create artist page" builds the artist, its price curve, and the
            applicant's owner role in one transaction. Until you press it, an
            accepted applicant has no page and no dashboard.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">Withdrawals</div>
            <h2>
              {pendingWithdrawals.length
                ? `${pendingWithdrawals.length} to send.`
                : "Nothing to send."}
            </h2>
            {owedCents > 0 && (
              <p>
                {formatUSD(owedCents)} owed and already debited from wallets.
              </p>
            )}
          </div>

          {pendingWithdrawals.map((w) => (
            <article className="wd-card" data-reveal key={w.id}>
              <div className="wd-head">
                <div>
                  <div className="wd-amount">{formatUSD(w.amount_cents)}</div>
                  <div className="admin-meta">
                    <a href={`mailto:${w.payee_email}`}>{w.payee_email}</a>
                    {w.payee_display_name ? ` · ${w.payee_display_name}` : ""} ·
                    requested {when(w.requested_at)}
                  </div>
                </div>
                <span className="status-pill pending">pending</span>
              </div>

              {/* Shown whole and never truncated. Sending crypto to a
                  half-read address is unrecoverable, so the one thing the
                  operator must copy exactly is the one thing always fully
                  visible and selectable. */}
              <div className="wd-address">
                <span className="bp-label">Send to</span>
                <code>{w.destination_address}</code>
              </div>

              <div className="admin-meta" style={{ marginBottom: 14 }}>
                Wallet balance after this request:{" "}
                {formatUSD(w.wallet_balance_cents)}
              </div>

              {rejecting === w.id ? (
                <div className="wd-reject">
                  <label className="dash-field">
                    <span className="bp-label">Why — the payee sees this</span>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. address failed validation"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </label>
                  <p className="bp-note">
                    Rejecting returns {formatUSD(w.amount_cents)} to their
                    wallet. Only do this if you have <em>not</em> sent anything.
                  </p>
                  <div className="admin-actions">
                    <button
                      type="button"
                      className="back-btn"
                      disabled={busy === w.id}
                      onClick={() => reject(w)}
                    >
                      Reject and refund
                    </button>
                    <button
                      type="button"
                      className="bp-cancel"
                      onClick={() => setRejecting(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="wd-pay">
                  <label className="dash-field">
                    <span className="bp-label">
                      Transaction reference — required
                    </span>
                    <input
                      type="text"
                      spellCheck="false"
                      autoComplete="off"
                      placeholder="Paste the tx hash after you've sent it"
                      value={txRefs[w.id] ?? ""}
                      onChange={(e) =>
                        setTxRefs({ ...txRefs, [w.id]: e.target.value })
                      }
                    />
                  </label>
                  <div className="admin-actions">
                    <button
                      type="button"
                      className="back-btn"
                      disabled={busy === w.id}
                      onClick={() => markPaid(w)}
                    >
                      Mark paid
                    </button>
                    <button
                      type="button"
                      className="filter-chip"
                      disabled={busy === w.id}
                      onClick={() => {
                        setRejecting(w.id);
                        setRejectReason("");
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}

          {settledWithdrawals.length > 0 && (
            <div className="admin-audit" data-reveal style={{ marginTop: 30 }}>
              {settledWithdrawals.map((w) => (
                <div className="audit-row" key={w.id}>
                  <span className="audit-when">{when(w.processed_at)}</span>
                  <span
                    className="audit-action"
                    style={{
                      color: w.status === "paid" ? "var(--up)" : "var(--soft)",
                    }}
                  >
                    {w.status}
                  </span>
                  <span className="audit-actor">
                    {formatUSD(w.amount_cents)} · {w.payee_email}
                  </span>
                  <span className="audit-detail">
                    {w.tx_reference || w.notes || "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="results-note" data-reveal>
            Requesting already took the money out of the wallet.{" "}
            <strong>Mark paid</strong> records what you sent and moves no money.{" "}
            <strong>Reject</strong> puts it back. Both are audited and neither
            can run twice.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">Feature flags</div>
            <h2>What's switched on.</h2>
          </div>
          <div className="admin-flags" data-reveal>
            {flags.map((f) => (
              <div className="admin-flag" key={f.key}>
                <div>
                  <div className="admin-flag-key">{f.key}</div>
                  <p>{f.description}</p>
                  <div className="admin-meta">Changed {when(f.updated_at)}</div>
                </div>
                <button
                  type="button"
                  className={`filter-chip${f.enabled ? " active" : ""}`}
                  disabled={busy === f.key}
                  onClick={() => toggleFlag(f)}
                >
                  {f.enabled ? "On" : "Off"}
                </button>
              </div>
            ))}
            {!flags.length && <p className="muted">No flags defined.</p>}
          </div>
          <p className="results-note" data-reveal>
            Takes effect for everyone on their next page load. Turning{" "}
            <code>regulated_offerings</code> off hides the Buy/Sell panel
            site-wide; open positions and wallets are untouched.
          </p>
        </div>
      </section>

      <section style={{ borderBottom: "none" }}>
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">Audit log</div>
            <h2>Who did what.</h2>
          </div>
          <div className="admin-audit" data-reveal>
            {audit.map((row) => (
              <div className="audit-row" key={row.id}>
                <span className="audit-when">{when(row.created_at)}</span>
                <span className="audit-action">{row.action}</span>
                <span className="audit-actor">{row.actor_email ?? "—"}</span>
                <span className="audit-detail">
                  {row.entity}
                  {row.entity_id ? ` ${row.entity_id}` : ""}
                  {row.detail && Object.keys(row.detail).length
                    ? ` · ${JSON.stringify(row.detail)}`
                    : ""}
                </span>
              </div>
            ))}
            {!audit.length && (
              <p className="muted">
                Nothing logged yet — the first admin action lands here.
              </p>
            )}
          </div>
          <p className="results-note" data-reveal>
            Newest 50. Append-only — nobody, admins included, can edit or delete
            these rows.
          </p>
        </div>
      </section>
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { useSession } from "../context/SessionContext.jsx";
import { useMemberships } from "../hooks/useMemberships.js";
import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { PageHero } from "../components/PageHero.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

const FIELDS = [
  {
    key: "artist_name",
    label: "Artist or project name",
    max: 80,
    placeholder: "The name you release under",
  },
  { key: "city", label: "City", max: 80, placeholder: "Where you're based" },
  {
    key: "genre",
    label: "Genre or scene",
    max: 60,
    placeholder: "However you'd describe it",
  },
];

const STATUS_COPY = {
  pending: "Received — not yet reviewed.",
  reviewing: "Being reviewed right now.",
  accepted: "Accepted.",
  declined: "Not moving forward this time.",
};

const EMPTY = {
  artist_name: "",
  city: "",
  genre: "",
  links: "",
  about: "",
};

export function Apply() {
  usePageTitle("Apply as an artist — Nextup");
  const { session, loading } = useSession();
  const memberships = useMemberships();

  const [application, setApplication] = useState(undefined); // undefined = loading
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) {
      setApplication(null);
      return;
    }
    const { data } = await supabase
      .from("artist_applications")
      .select(
        "id, artist_name, city, genre, links, about, status, created_at, review_notes",
      )
      .eq("user_id", session.user.id)
      .maybeSingle();
    setApplication(data ?? null);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  useReveal([application]);

  async function submit(e) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError("");
    const payload = {
      user_id: session.user.id,
      artist_name: form.artist_name.trim(),
      city: form.city.trim(),
      genre: form.genre.trim(),
      links: form.links.trim(),
      about: form.about.trim(),
    };
    const { error: err } = await supabase
      .from("artist_applications")
      .insert(payload);
    setSubmitting(false);
    if (err) {
      // 23505 = the one-application-per-account constraint; not a real failure,
      // just a stale view, so reload into the status state.
      if (err.code === "23505") {
        await load();
        return;
      }
      setError("Couldn't send that — check the fields and try again.");
      return;
    }
    await load();
  }

  if (loading) return <main />;

  if (!session) {
    return (
      <main>
        <Breadcrumb />
        <PageHero
          eyebrow="For artists"
          title="Apply to be on Nextup."
          style={{ borderBottom: "none" }}
        >
          <p>
            Applying needs an account — sign in with the form at the top of the
            page and we'll email you a link, no password. That's how you check
            your application's status later, and how we hand you the artist
            dashboard if you're accepted.
          </p>
        </PageHero>
      </main>
    );
  }

  if (application === undefined) {
    return (
      <main className="app-shell">
        <Breadcrumb />
        <section style={{ borderBottom: "none" }}>
          <div className="wrap">
            <p className="muted">Loading…</p>
          </div>
        </section>
      </main>
    );
  }

  // Already applied: show real state, not the form again.
  if (application) {
    const onTeam = memberships?.length > 0;
    return (
      <main className="app-shell">
        <Breadcrumb />
        <PageHero eyebrow="For artists" title="Your application.">
          <p>
            Submitted{" "}
            {new Date(application.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            .
          </p>
        </PageHero>

        <section style={{ borderBottom: "none" }}>
          <div className="wrap">
            <div className="apply-status" data-reveal>
              <span className={`status-pill ${application.status}`}>
                {application.status}
              </span>
              <span className="apply-status-copy">
                {STATUS_COPY[application.status]}
              </span>
            </div>

            {application.review_notes && (
              <p className="results-note" data-reveal>
                Note from the team: {application.review_notes}
              </p>
            )}

            {application.status === "accepted" && (
              <p className="results-note" data-reveal>
                {onTeam ? (
                  <>
                    Your artist page is live —{" "}
                    <Link to="/dashboard">open your dashboard →</Link>
                  </>
                ) : (
                  "We're setting your artist page up now; the dashboard appears here once it's ready."
                )}
              </p>
            )}

            {(application.status === "pending" ||
              application.status === "reviewing") && (
              <p className="results-note" data-reveal>
                A person reads every application — we're pre-launch, so reviews
                are done by hand and we won't pretend a queue position or a date
                we can't promise. You'll hear back by email at{" "}
                {session.user.email}.
              </p>
            )}

            <div className="apply-summary" data-reveal>
              <div className="section-head" style={{ marginBottom: 18 }}>
                <div className="eyebrow">What you sent</div>
              </div>
              <dl>
                <dt>Artist</dt>
                <dd>{application.artist_name}</dd>
                <dt>City</dt>
                <dd>{application.city}</dd>
                <dt>Genre</dt>
                <dd>{application.genre}</dd>
                <dt>Links</dt>
                <dd className="apply-pre">{application.links}</dd>
                <dt>About</dt>
                <dd className="apply-pre">{application.about}</dd>
              </dl>
              <p className="results-note">
                Need to change something? Email{" "}
                <a href="mailto:press@nextup.exchange">press@nextup.exchange</a>{" "}
                — applications can't be edited once sent, so we'd rather you
                talk to us than start a second one.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Breadcrumb />

      <PageHero eyebrow="For artists" title="Apply to be on Nextup.">
        <p>
          We're taking a small number of artists pre-launch. Tell us who you are
          and where to hear you — no press kit, no follower minimum. What
          matters is the music and that you're actually releasing.
        </p>
      </PageHero>

      <section style={{ borderBottom: "none" }}>
        <div className="wrap">
          <form className="dash-form" data-reveal onSubmit={submit}>
            {FIELDS.map((f) => (
              <label className="dash-field" key={f.key}>
                <span>{f.label}</span>
                <input
                  type="text"
                  required
                  maxLength={f.max}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={(e) =>
                    setForm({ ...form, [f.key]: e.target.value })
                  }
                />
              </label>
            ))}

            <label className="dash-field">
              <span>Where can we hear you?</span>
              <textarea
                required
                rows={3}
                maxLength={600}
                placeholder="Spotify, SoundCloud, Bandcamp, YouTube, a private link — whatever you've got, one per line"
                value={form.links}
                onChange={(e) => setForm({ ...form, links: e.target.value })}
              ></textarea>
            </label>

            <label className="dash-field">
              <span>What are you working on?</span>
              <textarea
                required
                rows={5}
                maxLength={1200}
                placeholder="A few sentences. What you're releasing next, what you're building, why now."
                value={form.about}
                onChange={(e) => setForm({ ...form, about: e.target.value })}
              ></textarea>
            </label>

            <div>
              <button type="submit" className="back-btn" disabled={submitting}>
                {submitting ? "Sending…" : "Send application"}
              </button>
              <div className="action-status">{error}</div>
            </div>
          </form>

          <p className="results-note" data-reveal>
            One application per account. It goes to a real person, not an
            autoresponder, and we reply by email — we're pre-launch, so reviews
            are manual and we won't invent a turnaround we can't keep. Nothing
            you send here is published anywhere.
          </p>
        </div>
      </section>
    </main>
  );
}

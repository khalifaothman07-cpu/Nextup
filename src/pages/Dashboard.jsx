import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { formatUSD, plural } from "../lib/format.js";
import { useSession } from "../context/SessionContext.jsx";
import { useMemberships } from "../hooks/useMemberships.js";
import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { PageHero } from "../components/PageHero.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

const EDIT_ROLES = ["owner", "manager", "content_editor"];
const EDITABLE_FIELDS = [
  ["name", "Artist name"],
  ["tagline", "Tagline"],
  ["genre", "Genre"],
  ["city", "City"],
];

export function Dashboard() {
  usePageTitle("Artist dashboard — Nextup");
  const { session, loading } = useSession();
  const memberships = useMemberships();

  const [artistId, setArtistId] = useState(null);
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (memberships?.length && !artistId) {
      setArtistId(memberships[0].artist_id);
    }
  }, [memberships, artistId]);

  const load = useCallback(async () => {
    if (!artistId) return;
    setData(null);
    const [artistRes, momentumRes, tracksRes] = await Promise.all([
      supabase.from("artists").select("*").eq("id", artistId).single(),
      supabase
        .from("artist_momentum_daily")
        .select(
          "day, score, follows_7d, trades_7d, purchases_7d, trade_volume_cents_7d, followers_total",
        )
        .eq("artist_id", artistId)
        .order("day", { ascending: false })
        .limit(14),
      supabase
        .from("tracks")
        .select("id, title, price_cents")
        .eq("artist_id", artistId)
        .order("sort_order", { ascending: true }),
    ]);

    const artist = artistRes.data;
    if (!artist) return;

    const trackIds = (tracksRes.data ?? []).map((t) => t.id);
    const [{ data: owned }, { data: curve }] = await Promise.all([
      trackIds.length
        ? supabase
            .from("track_ownership_public")
            .select("track_id")
            .in("track_id", trackIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("artist_curves")
        .select("supply, base_price_cents, k")
        .eq("artist_id", artistId)
        .maybeSingle(),
    ]);

    const ownedSet = new Set((owned ?? []).map((o) => o.track_id));
    const soldTracks = (tracksRes.data ?? []).filter((t) => ownedSet.has(t.id));

    setData({
      artist,
      momentum: momentumRes.data ?? [],
      tracks: tracksRes.data ?? [],
      soldCount: soldTracks.length,
      soldGrossCents: soldTracks.reduce((s, t) => s + t.price_cents, 0),
      priceCents: curve
        ? Math.round(curve.base_price_cents * Math.exp(curve.k * curve.supply))
        : null,
      supply: curve?.supply ?? null,
    });
    setForm({
      name: artist.name,
      tagline: artist.tagline,
      genre: artist.genre,
      city: artist.city,
      bio: artist.bio,
    });
    setSaveStatus("");
  }, [artistId]);

  useEffect(() => {
    load();
  }, [load]);

  useReveal([data]);

  const myRole = memberships?.find((m) => m.artist_id === artistId)?.role;
  const canEdit = EDIT_ROLES.includes(myRole ?? "");

  async function saveProfile(e) {
    e.preventDefault();
    if (!artistId) return;
    setSaving(true);
    setSaveStatus("Saving…");
    const updates = {
      name: form.name.trim(),
      tagline: form.tagline.trim(),
      genre: form.genre.trim(),
      city: form.city.trim(),
      bio: form.bio.trim(),
    };
    const { error } = await supabase
      .from("artists")
      .update(updates)
      .eq("id", artistId);
    setSaving(false);
    setSaveStatus(
      error
        ? "Could not save — you need an owner, manager, or content editor role."
        : "Saved — live on the public page immediately.",
    );
    if (!error) await load();
  }

  if (loading || memberships === null) return <main />;

  if (!session) {
    return (
      <main>
        <Breadcrumb />
        <PageHero
          eyebrow="Artist dashboard"
          title="Sign in to manage your artist."
          style={{ borderBottom: "none" }}
        >
          <p>
            Use the sign-in form at the top of the page. Dashboards are
            available to artist team members.
          </p>
        </PageHero>
      </main>
    );
  }

  if (!memberships.length) {
    return (
      <main>
        <Breadcrumb />
        <PageHero
          eyebrow="Artist dashboard"
          title="You're not on an artist team yet."
          style={{ borderBottom: "none" }}
        >
          <p>
            Dashboards belong to artist teams. If you're an artist,{" "}
            <Link to="/apply">apply to be on Nextup</Link> — once you're
            accepted and your page is set up, it shows up here. Already applied?{" "}
            <Link to="/apply">Check your status</Link>.
          </p>
        </PageHero>
      </main>
    );
  }

  // Same rule as the public artist page: an artist's own surface carries their
  // hue, so a team member's dashboard looks like the page it manages.
  const hue = data
    ? {
        "--accent": `color-mix(in srgb, ${data.artist.accent_from} 76%, var(--text) 24%)`,
        "--accent-deep": `color-mix(in srgb, ${data.artist.accent_to} 78%, #000 22%)`,
        "--accent-ink": "#fff",
      }
    : undefined;

  return (
    <main className="app-shell" style={hue}>
      <Breadcrumb />

      <PageHero eyebrow="Artist dashboard" title={data?.artist.name ?? "…"}>
        <p>
          Your role: <strong>{(myRole ?? "").replace("_", " ")}</strong>
          {data && (
            <>
              {" · "}
              <Link to={`/artist/${encodeURIComponent(data.artist.slug)}`}>
                View public page →
              </Link>
            </>
          )}
        </p>
        {memberships.length > 1 && (
          <div className="filter-chips" style={{ marginTop: 16 }}>
            {memberships.map((m) => (
              <button
                key={m.artist_id}
                type="button"
                className={`filter-chip${m.artist_id === artistId ? " active" : ""}`}
                onClick={() => setArtistId(m.artist_id)}
              >
                {m.artist_id === artistId && data
                  ? data.artist.name
                  : m.artist_id.slice(0, 8)}
              </button>
            ))}
          </div>
        )}
      </PageHero>

      {!data ? (
        <section style={{ borderBottom: "none" }}>
          <div className="wrap">
            <p className="muted">Loading dashboard…</p>
          </div>
        </section>
      ) : (
        <>
          <section>
            <div className="wrap">
              <div className="section-head" data-reveal>
                <div className="eyebrow">This week, from real activity</div>
                <h2>The numbers.</h2>
              </div>
              <div className="dash-stats" data-reveal>
                <div className="dash-stat">
                  <div className="n">{data.artist.follower_count}</div>
                  <div className="l">Followers</div>
                </div>
                <div className="dash-stat">
                  <div className="n">▲ {data.momentum[0]?.score ?? 0}</div>
                  <div className="l">Momentum (7d)</div>
                </div>
                <div className="dash-stat">
                  <div className="n">
                    {data.priceCents != null ? formatUSD(data.priceCents) : "—"}
                  </div>
                  <div className="l">Curve price</div>
                </div>
                <div className="dash-stat">
                  <div className="n">
                    {data.soldCount}/{data.tracks.length}
                  </div>
                  <div className="l">Songs sold</div>
                </div>
                <div className="dash-stat">
                  <div className="n">{formatUSD(data.soldGrossCents)}</div>
                  <div className="l">Song gross (list price)</div>
                </div>
              </div>

              {data.momentum[0] && (
                <p className="results-note" data-reveal>
                  Momentum this week:{" "}
                  {plural(data.momentum[0].follows_7d, "new follow")},{" "}
                  {plural(data.momentum[0].trades_7d, "position")} opened,{" "}
                  {plural(data.momentum[0].purchases_7d, "song")} purchased,{" "}
                  {formatUSD(data.momentum[0].trade_volume_cents_7d)} traded.
                  Recomputed daily from real platform activity only.
                </p>
              )}
            </div>
          </section>

          <section>
            <div className="wrap">
              <div className="section-head" data-reveal>
                <div className="eyebrow">Momentum history</div>
                <h2>Day by day.</h2>
              </div>
              <div className="momentum-history" data-reveal>
                {data.momentum.map((m, i) => {
                  const prev = data.momentum[i + 1];
                  const delta = prev ? m.score - prev.score : null;
                  return (
                    <div className="mh-row" key={m.day}>
                      <span className="mh-day">{m.day}</span>
                      <span className="mh-score">▲ {m.score}</span>
                      <span
                        className={`mh-delta${delta > 0 ? " up" : delta < 0 ? " down" : ""}`}
                      >
                        {delta == null
                          ? "first snapshot"
                          : delta > 0
                            ? `+${delta} vs prev day`
                            : delta < 0
                              ? `${delta} vs prev day`
                              : "no change"}
                      </span>
                    </div>
                  );
                })}
                {!data.momentum.length && (
                  <p className="muted">
                    No snapshots yet — the first one lands at the next daily
                    computation.
                  </p>
                )}
              </div>
              <p className="results-note" data-reveal>
                History accrues one snapshot per day — charts get meaningful as
                the record grows.
              </p>
            </div>
          </section>

          <section style={{ borderBottom: "none" }}>
            <div className="wrap">
              <div className="section-head" data-reveal>
                <div className="eyebrow">Public profile</div>
                <h2>
                  {canEdit ? "Edit what listeners see." : "Profile (read-only)"}
                </h2>
                {!canEdit && (
                  <p>
                    Your role ({(myRole ?? "").replace("_", " ")}) can view but
                    not edit — that needs owner, manager, or content editor.
                  </p>
                )}
              </div>
              {canEdit && form && (
                <form className="dash-form" data-reveal onSubmit={saveProfile}>
                  {EDITABLE_FIELDS.map(([key, label]) => (
                    <label className="dash-field" key={key}>
                      <span>{label}</span>
                      <input
                        type="text"
                        required
                        maxLength={key === "tagline" ? 90 : 60}
                        value={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label className="dash-field">
                    <span>Bio</span>
                    <textarea
                      rows={4}
                      maxLength={600}
                      value={form.bio}
                      onChange={(e) =>
                        setForm({ ...form, bio: e.target.value })
                      }
                    ></textarea>
                  </label>
                  <div>
                    <button
                      type="submit"
                      className="back-btn"
                      disabled={saving}
                    >
                      Save profile
                    </button>
                    <div className="action-status">{saveStatus}</div>
                  </div>
                </form>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

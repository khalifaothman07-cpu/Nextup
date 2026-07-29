import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { PageHero } from "../components/PageHero.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function Discover() {
  usePageTitle("Discover artists — Nextup");

  const [artists, setArtists] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("artists")
      .select("slug, name, genre, accent_from, accent_to, stat_30d_pct")
      .order("sort_order", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err || !data?.length) setError(true);
        else setArtists(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useReveal([artists]);

  return (
    <main>
      <Breadcrumb />

      <PageHero eyebrow="On Nextup right now" title="The full roster.">
        <p>Every artist currently on the platform, live from the database.</p>
      </PageHero>

      <section style={{ borderBottom: "none" }}>
        <div className="wrap">
          <div
            className={`discover-grid${artists ? "" : " loading"}`}
            data-reveal
          >
            {artists
              ? artists.map((a) => (
                  <Link
                    key={a.slug}
                    className="rcard"
                    to={`/artist/${encodeURIComponent(a.slug)}`}
                  >
                    <div
                      className="swatch"
                      style={{
                        background: `linear-gradient(155deg,${a.accent_from},${a.accent_to})`,
                      }}
                    ></div>
                    <h4>{a.name}</h4>
                    <div className="genre">{a.genre.toUpperCase()}</div>
                    <div className="stat">
                      <span className="muted">30-day</span>
                      <span className="g">▲ {a.stat_30d_pct}%</span>
                    </div>
                  </Link>
                ))
              : error
                ? "Roster is loading slowly — refresh in a moment."
                : "Loading roster…"}
          </div>
        </div>
      </section>
    </main>
  );
}

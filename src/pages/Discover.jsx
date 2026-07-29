import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { fetchLatestMomentum } from "../lib/momentum.js";
import { ArtistCard } from "../components/ArtistCard.jsx";
import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { PageHero } from "../components/PageHero.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

const SORTS = [
  { key: "momentum", label: "Momentum" },
  { key: "name", label: "Name A–Z" },
  { key: "newest", label: "Newest" },
  { key: "featured", label: "Featured" },
];

export function Discover() {
  usePageTitle("Discover artists — Nextup");

  const [artists, setArtists] = useState(null);
  const [momentum, setMomentum] = useState(new Map());
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("momentum");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from("artists")
        .select(
          "id, slug, name, genre, city, accent_from, accent_to, follower_count, sort_order, created_at",
        )
        .order("sort_order", { ascending: true }),
      fetchLatestMomentum(),
    ]).then(([{ data, error: err }, momentumMap]) => {
      if (cancelled) return;
      if (err || !data?.length) {
        setError(true);
        return;
      }
      setArtists(data);
      setMomentum(momentumMap);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const genres = useMemo(() => {
    if (!artists) return [];
    return [...new Set(artists.map((a) => a.genre))].sort();
  }, [artists]);

  const visible = useMemo(() => {
    if (!artists) return [];
    const q = query.trim().toLowerCase();
    const filtered = artists.filter((a) => {
      if (genre !== "all" && a.genre !== genre) return false;
      if (!q) return true;
      return [a.name, a.genre, a.city].some((f) => f.toLowerCase().includes(q));
    });
    const score = (a) => momentum.get(a.id)?.score ?? 0;
    return [...filtered].sort((a, b) => {
      if (sort === "momentum")
        return score(b) - score(a) || a.sort_order - b.sort_order;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "newest")
        return new Date(b.created_at) - new Date(a.created_at);
      return a.sort_order - b.sort_order;
    });
  }, [artists, momentum, query, genre, sort]);

  useReveal([artists]);

  return (
    <main>
      <Breadcrumb />

      <PageHero eyebrow="On Nextup right now" title="The full roster.">
        <p>
          Every artist on the platform, ranked by momentum computed from real
          activity — follows, trades, and song purchases. No editorial boosts,
          no seeded numbers.
        </p>
      </PageHero>

      <section style={{ borderBottom: "none" }}>
        <div className="wrap">
          {artists && (
            <div className="filter-bar" data-reveal>
              <input
                type="search"
                className="filter-search"
                placeholder="Search name, genre, city…"
                aria-label="Search artists"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="filter-chips">
                <button
                  type="button"
                  className={`filter-chip${genre === "all" ? " active" : ""}`}
                  onClick={() => setGenre("all")}
                >
                  All
                </button>
                {genres.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`filter-chip${genre === g ? " active" : ""}`}
                    onClick={() => setGenre(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <select
                className="sort-select"
                aria-label="Sort artists"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    Sort: {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            className={`discover-grid${artists ? "" : " loading"}`}
            data-reveal
          >
            {artists ? (
              visible.length ? (
                visible.map((a) => (
                  <ArtistCard
                    key={a.id}
                    artist={a}
                    momentum={momentum.get(a.id)}
                  />
                ))
              ) : (
                <p className="muted">No artists match — clear the filters.</p>
              )
            ) : error ? (
              "Roster is loading slowly — refresh in a moment."
            ) : (
              "Loading roster…"
            )}
          </div>

          {artists && (
            <p className="results-note">
              Momentum recomputes daily from the last 7 days of platform
              activity. New artists start at zero — that's honest, not broken.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

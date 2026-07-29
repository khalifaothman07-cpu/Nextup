import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { fetchArtistMomentum } from "../lib/momentum.js";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { TrackList } from "../components/TrackList.jsx";
import { BackingPanel } from "../components/BackingPanel.jsx";
import { FollowButton } from "../components/FollowButton.jsx";
import { MomentumPanel } from "../components/MomentumPanel.jsx";

export function Artist() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ status: "loading" });
  const [momentum, setMomentum] = useState(null);
  const [followerCount, setFollowerCount] = useState(0);

  usePageTitle(
    state.status === "loaded"
      ? `${state.artist.name} — Nextup`
      : "Artist — Nextup",
  );

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    if (!slug) {
      setState({ status: "no-slug" });
      return;
    }

    (async () => {
      const { data: artist, error: artistError } = await supabase
        .from("artists")
        .select("*")
        .eq("slug", slug)
        .single();

      if (cancelled) return;
      if (artistError || !artist) {
        setState({ status: "not-found" });
        return;
      }

      const { data: tracks } = await supabase
        .from("tracks")
        .select("id, title, price_cents")
        .eq("artist_id", artist.id)
        .order("sort_order", { ascending: true });

      const trackIds = (tracks ?? []).map((t) => t.id);
      const { data: owned } = trackIds.length
        ? await supabase
            .from("track_ownership_public")
            .select("track_id")
            .in("track_id", trackIds)
        : { data: [] };

      const momentumRow = await fetchArtistMomentum(artist.id);

      if (cancelled) return;
      setFollowerCount(artist.follower_count ?? 0);
      setMomentum(momentumRow);
      setState({
        status: "loaded",
        artist,
        tracks: tracks ?? [],
        ownedSet: new Set((owned ?? []).map((o) => o.track_id)),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const refreshFollowerCount = useCallback(async () => {
    if (state.status !== "loaded") return;
    const { data } = await supabase
      .from("artists")
      .select("follower_count")
      .eq("id", state.artist.id)
      .single();
    if (data) setFollowerCount(data.follower_count);
  }, [state]);

  useReveal([state.status]);

  const chargeState = searchParams.get("charge") ?? searchParams.get("deposit");

  return (
    <main className="wrap" style={{ paddingTop: 56 }}>
      <Link to="/" className="breadcrumb">
        ← Back to Nextup
      </Link>

      {chargeState === "success" && (
        <p
          style={{
            color: "var(--good)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          Payment received — confirming on-chain. This can take a few minutes;
          refresh this page once it confirms.
        </p>
      )}
      {chargeState === "cancelled" && (
        <p
          className="muted"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          Checkout cancelled — nothing was charged.
        </p>
      )}

      {state.status === "loading" && <p className="muted">Loading artist…</p>}

      {state.status === "no-slug" && (
        <p className="muted">
          No artist specified. <Link to="/">Back to Nextup →</Link>
        </p>
      )}

      {state.status === "not-found" && (
        <p className="muted">
          Couldn't find that artist. <Link to="/">Back to Nextup →</Link>
        </p>
      )}

      {state.status === "loaded" && (
        <>
          <div className="artist-hero" data-reveal>
            <div
              className="artist-swatch"
              style={{
                background: `linear-gradient(155deg,${state.artist.accent_from},${state.artist.accent_to})`,
              }}
            ></div>
            <div className="artist-meta">
              <div className="genre-city">
                {state.artist.genre.toUpperCase()} ·{" "}
                {state.artist.city.toUpperCase()}
              </div>
              <h1>{state.artist.name}</h1>
              <p className="tagline">{state.artist.tagline}</p>
              <p className="bio">{state.artist.bio}</p>
              <div className="artist-actions">
                <div className="artist-stat-pill">
                  {followerCount} follower{followerCount === 1 ? "" : "s"}
                </div>
                <FollowButton
                  artistId={state.artist.id}
                  onToggled={refreshFollowerCount}
                />
              </div>
            </div>
          </div>

          <MomentumPanel momentum={momentum} />

          <section style={{ borderBottom: "none", paddingBottom: 0 }}>
            <div className="two-col" style={{ marginTop: 64 }}>
              <div>
                <div className="section-head" style={{ marginBottom: 24 }}>
                  <div className="eyebrow">Side B</div>
                  <h2 style={{ fontSize: 28, marginTop: 12 }}>Own a song</h2>
                  <p style={{ marginTop: 10 }}>
                    Priced in USD, paid in crypto — BTC, ETH, USDC, and more.
                  </p>
                </div>
                <TrackList
                  artist={state.artist}
                  slug={slug}
                  tracks={state.tracks}
                  ownedSet={state.ownedSet}
                />
              </div>

              <div>
                <div className="section-head" style={{ marginBottom: 24 }}>
                  <div className="eyebrow">Side A</div>
                  <h2 style={{ fontSize: 28, marginTop: 12 }}>
                    Back {state.artist.name}
                  </h2>
                </div>
                <BackingPanel artist={state.artist} slug={slug} />
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

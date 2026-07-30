import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { fetchArtistMomentum } from "../lib/momentum.js";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { TrackList } from "../components/TrackList.jsx";
import { ArtistField } from "../components/ArtistField.jsx";
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

  const hue =
    state.status === "loaded"
      ? {
          "--f-from": state.artist.accent_from,
          "--f-to": state.artist.accent_to,
          // Any seeded artist colour has to stay legible on the dark ground and
          // on cream, so it is pulled toward the page's own text colour rather
          // than used raw. Buttons keep white text against it.
          "--accent": `color-mix(in srgb, ${state.artist.accent_from} 76%, var(--text) 24%)`,
          "--accent-deep": `color-mix(in srgb, ${state.artist.accent_to} 78%, #000 22%)`,
          "--accent-ink": "#fff",
        }
      : undefined;

  return (
    <main className="artist-page" style={hue}>
      {state.status === "loading" && (
        <p className="muted wrap" style={{ padding: "72px 0" }}>
          Loading artist…
        </p>
      )}

      {(state.status === "no-slug" || state.status === "not-found") && (
        <p className="muted wrap" style={{ padding: "72px 0" }}>
          Couldn't find that artist. <Link to="/">Back to Nextup →</Link>
        </p>
      )}

      {state.status === "loaded" && (
        <>
          <ArtistField artist={state.artist}>
            <Link to="/discover" className="field-back">
              ← Roster
            </Link>

            <div className="field-meta">
              <div>
                <span>Genre</span>
                {state.artist.genre}
              </div>
              <div>
                <span>Based</span>
                {state.artist.city}
              </div>
              <div>
                <span>Followers</span>
                {followerCount.toLocaleString("en-US")}
              </div>
              <div>
                <span>Momentum 7d</span>▲ {momentum?.score ?? 0}
              </div>
            </div>

            <h1 className="field-name">{state.artist.name}</h1>
            <p className="field-tagline">{state.artist.tagline}</p>

            <div className="field-actions">
              <FollowButton
                artistId={state.artist.id}
                onToggled={refreshFollowerCount}
              />
            </div>
          </ArtistField>

          {chargeState === "success" && (
            <div className="wrap notice good">
              Payment received — confirming on-chain. That can take a few
              minutes; refresh once it does.
            </div>
          )}
          {chargeState === "cancelled" && (
            <div className="wrap notice">
              Checkout cancelled — nothing was charged.
            </div>
          )}

          <div className="wrap artist-body">
            <div className="artist-main">
              <div className="col-head">
                <h2>Songs</h2>
                <span>One owner each · priced in USD, paid in crypto</span>
              </div>
              <TrackList
                slug={slug}
                tracks={state.tracks}
                ownedSet={state.ownedSet}
              />

              <div className="col-head" style={{ marginTop: 56 }}>
                <h2>About</h2>
              </div>
              <p className="artist-bio">{state.artist.bio}</p>

              <MomentumPanel momentum={momentum} />
            </div>

            <aside className="artist-side">
              <div className="col-head">
                <h2>Back {state.artist.name}</h2>
              </div>
              <BackingPanel artist={state.artist} slug={slug} />
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

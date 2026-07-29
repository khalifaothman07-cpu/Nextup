import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { formatUSD } from "../lib/format.js";
import { useSession } from "../context/SessionContext.jsx";

export function TrackList({ artist, slug, tracks, ownedSet }) {
  const { session } = useSession();
  const [buying, setBuying] = useState(null);

  async function handleBuy(trackId) {
    if (!session) {
      alert(
        "Sign in at the top of the page first, then come back and try again.",
      );
      return;
    }
    setBuying(trackId);
    const { data, error } = await supabase.functions.invoke("create-charge", {
      body: { kind: "song", track_id: trackId, slug },
    });
    if (error || !data?.hosted_url) {
      setBuying(null);
      alert(data?.error ?? "Could not start checkout — try again.");
      return;
    }
    window.location.href = data.hosted_url;
  }

  if (!tracks?.length) {
    return (
      <p className="muted" style={{ padding: "20px 0" }}>
        No tracks listed yet.
      </p>
    );
  }

  return (
    <div className="track-list">
      {tracks.map((t) => (
        <div className="track-row" key={t.id}>
          <div>
            <div className="track-title">{t.title}</div>
            <div className="track-price">
              {formatUSD(t.price_cents)} in crypto
            </div>
          </div>
          {ownedSet.has(t.id) ? (
            <span className="track-owned">Owned</span>
          ) : (
            <button
              type="button"
              className="track-buy"
              disabled={buying === t.id}
              onClick={() => handleBuy(t.id)}
            >
              {buying === t.id ? "Redirecting to checkout…" : "Own this song"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

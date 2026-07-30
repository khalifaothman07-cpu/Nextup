import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { formatUSD } from "../lib/format.js";
import { useSession } from "../context/SessionContext.jsx";

/**
 * Numbered track rows, following the reference's popular-tracks column:
 * ordinal, title, then the commercial state right-aligned. Compact enough
 * that a full catalogue reads as a list rather than a stack of cards.
 */
export function TrackList({ slug, tracks, ownedSet }) {
  const { session } = useSession();
  const [buying, setBuying] = useState(null);
  const [error, setError] = useState("");

  async function handleBuy(trackId) {
    if (!session) {
      setError("Sign in at the top of the page, then try again.");
      return;
    }
    setBuying(trackId);
    setError("");
    const { data, error: err } = await supabase.functions.invoke(
      "create-charge",
      { body: { kind: "song", track_id: trackId, slug } },
    );
    if (err || !data?.hosted_url) {
      setBuying(null);
      setError(data?.error ?? "Couldn't start checkout — try again.");
      return;
    }
    window.location.href = data.hosted_url;
  }

  if (!tracks?.length) {
    return <p className="muted">No tracks listed yet.</p>;
  }

  return (
    <>
      <ol className="tracks">
        {tracks.map((t, i) => (
          <li className="track" key={t.id}>
            <span className="track-n">{String(i + 1).padStart(2, "0")}</span>
            <span className="track-title">{t.title}</span>
            <span className="track-price">{formatUSD(t.price_cents)}</span>
            {ownedSet.has(t.id) ? (
              <span className="track-owned">Owned</span>
            ) : (
              <button
                type="button"
                className="track-buy"
                disabled={buying === t.id}
                onClick={() => handleBuy(t.id)}
              >
                {buying === t.id ? "Redirecting…" : "Own it"}
              </button>
            )}
          </li>
        ))}
      </ol>
      {/* Replaces an alert(). A modal dialog for "you need to sign in" was
          both jarring and invisible to the screenshot harness. */}
      {error && <div className="action-status">{error}</div>}
    </>
  );
}

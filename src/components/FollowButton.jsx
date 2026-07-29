import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useSession } from "../context/SessionContext.jsx";

/**
 * Follow/unfollow via direct RLS-guarded writes to artist_follows (users can
 * only insert/delete their own rows). The public follower_count on artists
 * is maintained by a DB trigger, so callers refetch it via onToggled.
 */
export function FollowButton({ artistId, onToggled }) {
  const { session } = useSession();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    setNote("");
    if (!session) {
      setFollowing(false);
      return;
    }
    supabase
      .from("artist_follows")
      .select("artist_id")
      .eq("artist_id", artistId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setFollowing(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [session, artistId]);

  async function toggle() {
    if (!session) {
      setNote("Sign in at the top of the page to follow.");
      return;
    }
    setBusy(true);
    if (following) {
      const { error } = await supabase
        .from("artist_follows")
        .delete()
        .eq("artist_id", artistId)
        .eq("user_id", session.user.id);
      if (!error) setFollowing(false);
      else setNote("Could not unfollow — try again.");
    } else {
      const { error } = await supabase
        .from("artist_follows")
        .insert({ artist_id: artistId, user_id: session.user.id });
      if (!error || error.code === "23505") setFollowing(true);
      else setNote("Could not follow — try again.");
    }
    setBusy(false);
    onToggled?.();
  }

  return (
    <>
      <button
        type="button"
        className={`follow-btn${following ? " following" : ""}`}
        disabled={busy}
        onClick={toggle}
      >
        {following ? "Following" : "Follow"}
      </button>
      {note && <span className="follow-note">{note}</span>}
    </>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useSession } from "../context/SessionContext.jsx";

/**
 * The signed-in user's artist-team memberships (own rows only under RLS).
 * Returns null while loading, [] when none.
 */
export function useMemberships() {
  const { session } = useSession();
  const [memberships, setMemberships] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setMemberships([]);
      return;
    }
    supabase
      .from("artist_members")
      .select("artist_id, role")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        if (!cancelled) setMemberships(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return memberships;
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useSession } from "../context/SessionContext.jsx";

/**
 * The signed-in user's granted platform roles ("admin", "curator") from
 * `user_roles`. Returns null while loading, [] when none.
 *
 * This is a *display* signal only — it decides whether the Admin link is worth
 * rendering, nothing more. Every admin action is re-checked server-side inside
 * the `admin_*` functions against auth.uid(), so a user who fakes this array in
 * devtools gets a page full of buttons that all return "not authorised".
 */
export function useRoles() {
  const { session } = useSession();
  const [roles, setRoles] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setRoles([]);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        if (!cancelled) setRoles((data ?? []).map((r) => r.role));
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return roles;
}

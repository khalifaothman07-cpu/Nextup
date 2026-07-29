import { supabase } from "./supabaseClient.js";

export async function joinWaitlist(email, source) {
  const { error } = await supabase
    .from("waitlist_signups")
    .insert({ email, source });
  if (error) {
    if (error.code === "23505") return { ok: true, already: true };
    return {
      ok: false,
      message: "Something went wrong — try again in a moment.",
    };
  }
  return { ok: true, already: false };
}

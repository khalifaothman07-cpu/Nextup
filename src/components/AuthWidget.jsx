import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useSession } from "../context/SessionContext.jsx";

/**
 * Seconds before the same browser can request another sign-in link.
 *
 * This is politeness, not security. It lives in the page, so anyone who wants
 * to bypass it can — the real limit on the magic-link endpoint is Supabase's
 * own, configured in the dashboard, because that endpoint is Supabase's and
 * not ours to put a trigger on. See docs/SECURITY.md.
 *
 * It earns its place anyway: without it, an ordinary person who doesn't see
 * the email lands on "Sign in" three or four times in ten seconds and burns
 * the project's real hourly email quota on one confused user.
 */
const RESEND_COOLDOWN_SECONDS = 30;

export function AuthWidget() {
  const { session, loading } = useSession();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (loading) return <div className="auth-widget" />;

  if (session) {
    return (
      <div className="auth-signed-in">
        <span className="auth-email">{session.user.email}</span>
        <button
          className="auth-signout"
          type="button"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (cooldown > 0) return;
    setSending(true);
    setNote("Sending link…");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    setSending(false);
    if (error) {
      // Supabase returns 429 when its own auth limit trips.
      setNote(
        error.status === 429
          ? "Too many sign-in attempts. Wait a minute and try again."
          : "Couldn't send that link — try again.",
      );
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setNote(`Check ${email} for a sign-in link.`);
  }

  return (
    <>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="your@email.com"
          aria-label="Email address"
          className="auth-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          className="auth-btn"
          disabled={sending || cooldown > 0}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Sign in"}
        </button>
      </form>
      <div className="auth-note">{note}</div>
    </>
  );
}

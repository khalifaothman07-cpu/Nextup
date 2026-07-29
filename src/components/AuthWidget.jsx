import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useSession } from "../context/SessionContext.jsx";

export function AuthWidget() {
  const { session, loading } = useSession();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");

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
    setSending(true);
    setNote("Sending link…");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    setSending(false);
    setNote(
      error
        ? "Could not send link — try again."
        : `Check ${email} for a sign-in link.`,
    );
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
        <button type="submit" className="auth-btn" disabled={sending}>
          Sign in
        </button>
      </form>
      <div className="auth-note">{note}</div>
    </>
  );
}

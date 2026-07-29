import { useState } from "react";
import { joinWaitlist } from "../lib/waitlist.js";

export function WaitlistForm({ source, style }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setStatus("Adding you…");
    const result = await joinWaitlist(email, source);
    setBusy(false);
    if (!result.ok) {
      setStatus(result.message);
      return;
    }
    setStatus(
      result.already
        ? `You're already on the list at ${email}.`
        : `You're on the list — we'll reach out at ${email}.`,
    );
    setEmail("");
  }

  return (
    <>
      <form className="waitlist" style={style} onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="your@email.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          Get Early Access
        </button>
      </form>
      <div className="wl-status">{status}</div>
    </>
  );
}

import { supabase } from "./supabase-client.js";

export function formatUSD(cents) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

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

export function wireWaitlistForm(formId, statusId, source) {
  const form = document.getElementById(formId);
  const status = document.getElementById(statusId);
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    const email = input.value.trim();
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "Adding you…";
    const result = await joinWaitlist(email, source);
    button.disabled = false;
    if (!result.ok) {
      status.textContent = result.message;
      return;
    }
    status.textContent = result.already
      ? `You're already on the list at ${email}.`
      : `You're on the list — we'll reach out at ${email}.`;
    input.value = "";
  });
}

/**
 * Renders a sign-in pill into `el`. Calls onChange(session) whenever auth state
 * settles, so callers can enable/disable actions that require a signed-in user.
 */
export function initAuthWidget(el, onChange) {
  function renderSignedOut() {
    el.innerHTML = `
      <form class="auth-form" id="authForm">
        <input type="email" required placeholder="your@email.com" aria-label="Email address" class="auth-input">
        <button type="submit" class="auth-btn">Sign in</button>
      </form>
      <div class="auth-note" id="authNote"></div>
    `;
    el.querySelector("#authForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = el.querySelector(".auth-input");
      const note = el.querySelector("#authNote");
      const email = input.value.trim();
      const button = el.querySelector(".auth-btn");
      button.disabled = true;
      note.textContent = "Sending link…";
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      });
      button.disabled = false;
      note.textContent = error
        ? "Could not send link — try again."
        : `Check ${email} for a sign-in link.`;
    });
  }

  function renderSignedIn(session) {
    el.innerHTML = `
      <div class="auth-signed-in">
        <span class="auth-email">${session.user.email}</span>
        <button class="auth-signout" id="authSignOut">Sign out</button>
      </div>
    `;
    el.querySelector("#authSignOut").addEventListener("click", async () => {
      await supabase.auth.signOut();
    });
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) renderSignedIn(session);
    else renderSignedOut();
    onChange?.(session);
  });

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) renderSignedIn(session);
    else renderSignedOut();
    onChange?.(session);
  });
}

export function wireReveal() {
  const revealEls = document.querySelectorAll("[data-reveal]");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );
  revealEls.forEach((el) => io.observe(el));
}

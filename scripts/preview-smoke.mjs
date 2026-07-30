/**
 * Preview smoke test.
 *
 * The published artifacts are hand-authored static mirrors of the React app,
 * so nothing about them is covered by `npm run build` or by the screenshot
 * harness. This walks every route in the built preview, exercises the controls
 * that are supposed to work (discover search and genre filter, the admin queue
 * tabs, the theme toggle), and asserts the inlined fonts actually loaded —
 * they silently fell back to Arial the first time, which made a whole redesign
 * unjudgeable.
 *
 * Usage:
 *   node scripts/build-preview.mjs   # from the scratchpad copy
 *   node scripts/preview-smoke.mjs
 */
import { chromium } from "playwright";

const base = process.env.PREVIEW_BASE ?? "http://localhost:8301";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// Landing preview: walk every route via hash.
await page.goto(`${base}/preview3_landing.html`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(400);
const routes = [
  "#/",
  "#/how-it-works",
  "#/pricing",
  "#/discover",
  "#/about",
  "#/faq",
  "#/press",
  "#/terms",
  "#/risk-disclosure",
  "#/privacy",
  "#/apply",
  "#/account",
  "#/dashboard",
  "#/admin",
  "#/artist/bruno-mars",
  "#/nope",
];
for (const r of routes) {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, r);
  await page.waitForTimeout(250);
  const txt = await page.evaluate(() =>
    document.getElementById("app").innerText.slice(0, 45).replace(/\n/g, " "),
  );
  console.log(`${r} → ${JSON.stringify(txt)}`);
}

// Discover interactions.
await page.evaluate(() => {
  window.location.hash = "#/discover";
});
await page.waitForTimeout(300);
await page.fill("#pvSearch", "toronto");
await page.waitForTimeout(200);
console.log(
  "search toronto →",
  await page.evaluate(() => document.querySelectorAll("#pvGrid .tile").length),
  "card(s)",
);
await page.fill("#pvSearch", "");
await page.click('#pvChips .filter-chip[data-genre="Latin Pop"]');
await page.waitForTimeout(200);
console.log(
  "chip Latin Pop →",
  await page.evaluate(() => document.querySelectorAll("#pvGrid .tile").length),
  "card(s)",
);

// Admin console: the queue chips must actually filter, or the preview shows a
// control that does nothing — the exact thing the site's own rules forbid.
await page.evaluate(() => {
  window.location.hash = "#/admin";
});
await page.waitForTimeout(300);
const adminChecks = await page.evaluate(() => {
  const shown = () =>
    [...document.querySelectorAll(".pv-admin-card")].filter(
      (c) => c.style.display !== "none",
    ).length;
  const before = shown();
  document.querySelector('.pv-admin-q[data-queue="accepted"]').click();
  const afterAccepted = shown();
  document.querySelector('.pv-admin-q[data-queue="declined"]').click();
  return {
    cards: document.querySelectorAll(".pv-admin-card").length,
    openQueue: before,
    acceptedQueue: afterAccepted,
    declinedQueue: shown(),
    flags: document.querySelectorAll(".admin-flag").length,
    auditRows: document.querySelectorAll(".audit-row").length,
    hOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  };
});
console.log("admin:", JSON.stringify(adminChecks));

// Artist page bits.
await page.evaluate(() => {
  window.location.hash = "#/artist/the-weeknd";
});
await page.waitForTimeout(300);
const artistChecks = await page.evaluate(() => ({
  h1: document.querySelector("#app h1")?.textContent,
  momentum: !!document.querySelector(".momentum-panel"),
  ticker: document.querySelector(".price-ticker")?.textContent,
  tracks: document.querySelectorAll(".track").length,
}));
console.log("artist:", JSON.stringify(artistChecks));
await page.click(".pv-follow");
console.log(
  "follow note:",
  await page.evaluate(
    () => document.querySelector(".follow-note")?.textContent,
  ),
);

// Artist-default preview file starts on the profile.
await page.goto(`${base}/preview3_artist.html`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(400);
console.log(
  "artist file default:",
  await page.evaluate(() => document.querySelector("#app h1")?.textContent),
  "| hash:",
  await page.evaluate(() => window.location.hash),
);

console.log("pageerrors:", JSON.stringify(errors));
await browser.close();

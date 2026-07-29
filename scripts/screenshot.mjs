/**
 * Visual verification harness.
 *
 * Renders the real production build in headless Chromium and writes full-page
 * screenshots, including the signed-in pages (/account, /dashboard) that a
 * static preview can never show. It fakes a Supabase session in localStorage
 * and fulfils /rest/v1/* with rows shaped like the real tables, so what you
 * see is the actual React code rendering — not a facsimile.
 *
 * Why this exists: "npm run build passes" says nothing about whether a page
 * is correct. The first run of this script caught four real defects that had
 * already been committed (money rounded to whole dollars, a role label
 * rendering as "content&editor", "1 songs purchased", marketing-page spacing
 * on tool pages). Look at the output before claiming a screen works.
 *
 * Usage:
 *   npm run build && npm run preview -- --port 8200 --strictPort &
 *   node scripts/screenshot.mjs
 *
 * Mock fidelity matters: honour PostgREST semantics (?limit=, id=in.(...),
 * the single-object Accept header) or the mock invents bugs that aren't real
 * and hides ones that are. Three false alarms in the first session came from
 * exactly that.
 */
import { chromium } from "playwright";

const OUT =
  "/tmp/claude-0/-home-user-Unbeatable/4457052f-2c62-57b7-af72-dd7380031700/scratchpad";
const REF = "djnsjtlkjgjqmfcucjqp";
const UID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

// --- demo data, shaped exactly like the real tables ---
const A = {
  marra: "6bf4e129-82b5-402f-a6ec-9b6252413a94",
  dry: "461256fe-8620-4ffc-a69c-c25ab2b1b2b2",
  habib: "633573d9-3f67-409b-aa7b-6436345e3820",
  nadine: "c633524f-0271-4e81-a2ce-1a90e02c6020",
  older: "4d260a6a-6cb9-41e6-aefa-35cc2444162e",
};

const ARTISTS = [
  {
    id: A.marra,
    slug: "marra-vale",
    name: "Marra Vale",
    genre: "R&B / Alt",
    city: "São Paulo",
    tagline: "Three songs about the same low tide.",
    bio: "Marra Vale writes slow-burn R&B about staying too long in places that stopped being good for her. 'Salt Water' broke out on a single São Paulo open-mic clip; the rest of the EP hasn't left rotation since.",
    accent_from: "#8b5cf6",
    accent_to: "#4c3b8f",
    follower_count: 128,
    sort_order: 1,
    created_at: "2026-07-28T04:10:31.911683+00:00",
    stat_30d_pct: 212,
  },
  {
    id: A.dry,
    slug: "dry-season",
    name: "Dry Season",
    genre: "Indie Rock",
    city: "Manchester",
    tagline: "Guitar rock for the drive home at 2am.",
    bio: "A three-piece that recorded their first EP live in a garage.",
    accent_from: "#ff6b57",
    accent_to: "#c23f3f",
    follower_count: 54,
    sort_order: 2,
    created_at: "2026-07-28T04:10:31.911683+00:00",
    stat_30d_pct: 96,
  },
  {
    id: A.habib,
    slug: "habib-younis",
    name: "Habib Younis",
    genre: "Khaleeji Fusion",
    city: "Dubai",
    tagline: "Oud riffs over 808s, no apology.",
    bio: "Khaleeji Fusion is what happens when neither influence wins.",
    accent_from: "#c6a15b",
    accent_to: "#7a5f2f",
    follower_count: 31,
    sort_order: 3,
    created_at: "2026-07-28T04:10:31.911683+00:00",
    stat_30d_pct: 64,
  },
  {
    id: A.nadine,
    slug: "nadine-cole",
    name: "Nadine Cole",
    genre: "Electro Pop",
    city: "Seoul",
    tagline: "Pop hooks built for one earbud in.",
    bio: "Writes, produces, and mixes everything herself between shifts.",
    accent_from: "#3fae7a",
    accent_to: "#1d5c40",
    follower_count: 12,
    sort_order: 4,
    created_at: "2026-07-28T04:10:31.911683+00:00",
    stat_30d_pct: 41,
  },
  {
    id: A.older,
    slug: "older-brother",
    name: "Older Brother",
    genre: "Lo-Fi / Jazz",
    city: "Portland",
    tagline: "Jazz chords, bedroom mic, zero polish.",
    bio: "Recorded entirely on a phone; still cleaner than most studio sessions.",
    accent_from: "#5b8fc6",
    accent_to: "#2c4d70",
    follower_count: 3,
    sort_order: 5,
    created_at: "2026-07-28T04:10:31.911683+00:00",
    stat_30d_pct: 19,
  },
];

const TRACKS = [
  {
    id: "t-salt",
    artist_id: A.marra,
    title: "Salt Water",
    price_cents: 4900,
    sort_order: 1,
  },
  {
    id: "t-low",
    artist_id: A.marra,
    title: "Low Tide",
    price_cents: 4900,
    sort_order: 2,
  },
  {
    id: "t-25th",
    artist_id: A.marra,
    title: "25th & Gray",
    price_cents: 4900,
    sort_order: 3,
  },
];

const MOMENTUM = {
  [A.marra]: [
    {
      day: "2026-07-29",
      score: 43,
      follows_7d: 6,
      trades_7d: 3,
      purchases_7d: 1,
      trade_volume_cents_7d: 2500,
      followers_total: 128,
    },
    {
      day: "2026-07-28",
      score: 38,
      follows_7d: 5,
      trades_7d: 3,
      purchases_7d: 1,
      trade_volume_cents_7d: 2000,
      followers_total: 122,
    },
    {
      day: "2026-07-27",
      score: 40,
      follows_7d: 6,
      trades_7d: 3,
      purchases_7d: 1,
      trade_volume_cents_7d: 1500,
      followers_total: 117,
    },
    {
      day: "2026-07-26",
      score: 31,
      follows_7d: 4,
      trades_7d: 2,
      purchases_7d: 1,
      trade_volume_cents_7d: 1000,
      followers_total: 111,
    },
    {
      day: "2026-07-25",
      score: 22,
      follows_7d: 3,
      trades_7d: 2,
      purchases_7d: 0,
      trade_volume_cents_7d: 500,
      followers_total: 104,
    },
    {
      day: "2026-07-24",
      score: 22,
      follows_7d: 4,
      trades_7d: 2,
      purchases_7d: 0,
      trade_volume_cents_7d: 0,
      followers_total: 98,
    },
    {
      day: "2026-07-23",
      score: 14,
      follows_7d: 3,
      trades_7d: 1,
      purchases_7d: 0,
      trade_volume_cents_7d: 0,
      followers_total: 91,
    },
  ],
  [A.dry]: [
    {
      day: "2026-07-29",
      score: 12,
      follows_7d: 4,
      trades_7d: 0,
      purchases_7d: 0,
      trade_volume_cents_7d: 0,
      followers_total: 54,
    },
  ],
  [A.habib]: [
    {
      day: "2026-07-29",
      score: 7,
      follows_7d: 1,
      trades_7d: 0,
      purchases_7d: 0,
      trade_volume_cents_7d: 4000,
      followers_total: 31,
    },
  ],
  [A.nadine]: [
    {
      day: "2026-07-29",
      score: 3,
      follows_7d: 1,
      trades_7d: 0,
      purchases_7d: 0,
      trade_volume_cents_7d: 0,
      followers_total: 12,
    },
  ],
  [A.older]: [
    {
      day: "2026-07-29",
      score: 0,
      follows_7d: 0,
      trades_7d: 0,
      purchases_7d: 0,
      trade_volume_cents_7d: 0,
      followers_total: 3,
    },
  ],
};
const allMomentum = Object.entries(MOMENTUM).flatMap(([artist_id, rows]) =>
  rows.map((r) => ({ artist_id, ...r })),
);

const b64 = (o) =>
  Buffer.from(JSON.stringify(o))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
const USER = {
  id: UID,
  aud: "authenticated",
  role: "authenticated",
  email: "demo@nextup.exchange",
  email_confirmed_at: "2026-07-20T10:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-07-20T10:00:00Z",
  updated_at: "2026-07-29T10:00:00Z",
};
const JWT = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, email: USER.email, role: "authenticated", aud: "authenticated", exp, iat: Math.floor(Date.now() / 1000) })}.demo`;
const SESSION = {
  access_token: JWT,
  token_type: "bearer",
  expires_in: 2592000,
  expires_at: exp,
  refresh_token: "demo-refresh",
  user: USER,
};

// Flipped per-shot so /apply can be captured in both of its signed-in states.
let applicationRow = null;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1.5,
});
const errors = [];
const unmatched = [];

await ctx.addInitScript(
  ([key, sess]) => {
    window.localStorage.setItem(key, JSON.stringify(sess));
  },
  [`sb-${REF}-auth-token`, SESSION],
);

await ctx.route("**/auth/v1/**", (route) => {
  const u = route.request().url();
  if (u.includes("/user"))
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(USER),
    });
  return route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ...SESSION }),
  });
});

await ctx.route("**/rest/v1/**", (route) => {
  const url = new URL(route.request().url());
  const t = url.pathname.split("/rest/v1/")[1] ?? "";
  const s = decodeURIComponent(url.search);
  const single = (route.request().headers()["accept"] ?? "").includes(
    "vnd.pgrst.object",
  );
  const send = (body) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  // honour PostgREST's ?limit=N the way the real API does, then collapse for
  // single()/maybeSingle() — otherwise a limit(1).maybeSingle() query gets
  // handed every row and legitimately errors.
  const one = (arr) => {
    const lim = s.match(/[?&]limit=(\d+)/);
    const rows = lim ? arr.slice(0, Number(lim[1])) : arr;
    return single ? (rows[0] ?? null) : rows;
  };
  const idOf = (param) => {
    const m = s.match(new RegExp(`${param}=eq\\.([^&]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  };

  switch (t) {
    case "artists": {
      const slug = idOf("slug"),
        id = idOf("id");
      if (slug) return send(one(ARTISTS.filter((a) => a.slug === slug)));
      if (id) return send(one(ARTISTS.filter((a) => a.id === id)));
      return send(ARTISTS);
    }
    case "artist_momentum_daily": {
      const aid = idOf("artist_id");
      return send(
        one(
          aid
            ? (MOMENTUM[aid] ?? []).map((r) => ({ artist_id: aid, ...r }))
            : allMomentum,
        ),
      );
    }
    case "artist_members":
      return send(
        one([{ artist_id: A.marra, user_id: UID, role: "content_editor" }]),
      );
    case "user_roles":
      return send(one([{ user_id: UID, role: "curator" }]));
    case "artist_applications":
      return send(one(applicationRow ? [applicationRow] : []));
    case "profiles":
      return send(one([{ id: UID, display_name: "K. Othman" }]));
    case "artist_follows": {
      if (route.request().method() !== "GET") return send({});
      const aid = idOf("artist_id");
      const rows = [
        {
          user_id: UID,
          artist_id: A.marra,
          created_at: "2026-07-24T09:12:00Z",
        },
        {
          user_id: UID,
          artist_id: A.habib,
          created_at: "2026-07-26T18:40:00Z",
        },
      ];
      return send(one(aid ? rows.filter((r) => r.artist_id === aid) : rows));
    }
    case "wallets":
      return send(one([{ user_id: UID, balance_cents: 4750 }]));
    case "withdrawal_requests":
      return send(
        one([
          {
            id: "w-1",
            amount_cents: 1500,
            destination_address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            status: "pending",
            requested_at: "2026-07-28T22:05:00Z",
          },
        ]),
      );
    case "positions":
      return send(
        one([
          {
            id: "p-1",
            user_id: UID,
            artist_id: A.marra,
            direction: "positive",
            units: 9.94,
            stake_cents: 2000,
            entry_price_cents: 201,
            status: "open",
            opened_at: "2026-07-27T14:22:00Z",
          },
          {
            id: "p-2",
            user_id: UID,
            artist_id: A.dry,
            direction: "negative",
            units: 4.8,
            stake_cents: 500,
            entry_price_cents: 104,
            status: "open",
            opened_at: "2026-07-28T11:03:00Z",
          },
        ]),
      );
    case "song_ownership":
      return send(
        one([
          {
            track_id: "t-salt",
            price_cents: 4900,
            created_at: "2026-07-25T16:30:00Z",
          },
        ]),
      );
    case "tracks": {
      const aid = idOf("artist_id");
      const inList = s.match(/id=in\.\(([^)]*)\)/);
      if (inList) {
        const ids = inList[1].split(",").map((x) => x.replace(/^"|"$/g, ""));
        return send(one(TRACKS.filter((x) => ids.includes(x.id))));
      }
      return send(
        one(aid ? TRACKS.filter((x) => x.artist_id === aid) : TRACKS),
      );
    }
    case "track_ownership_public":
      return send(
        one([{ track_id: "t-salt", owned_at: "2026-07-25T16:30:00Z" }]),
      );
    case "artist_curves": {
      const aid = idOf("artist_id") ?? A.marra;
      const supply = aid === A.marra ? 1400 : 80;
      return send(
        one([{ artist_id: aid, supply, base_price_cents: 100, k: 0.0005 }]),
      );
    }
    case "feature_flags":
      return send(one([{ key: "regulated_offerings", enabled: true }]));
    default:
      unmatched.push(t + s);
      return send(one([]));
  }
});

const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e.message}`));

async function shot(path, file, { width = 1280 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`http://localhost:8200${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await page.waitForTimeout(1600);
  // reveal-on-scroll elements below the fold never fire IO in a full-page shot
  await page.evaluate(() =>
    document
      .querySelectorAll("[data-reveal]")
      .forEach((el) => el.classList.add("in")),
  );
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  const h1 = await page.evaluate(
    () => document.querySelector("main h1")?.textContent ?? "(none)",
  );
  console.log(`${file.padEnd(28)} ${path.padEnd(22)} h1="${h1}"`);
}

/** Never let one crashed capture swallow the rest of the run's findings. */
async function tryShot(...args) {
  try {
    await shot(...args);
  } catch (e) {
    errors.push(`shot ${args[1]} failed: ${e.message}`);
    console.log(`${String(args[1]).padEnd(28)} FAILED: ${e.message}`);
  }
}

/**
 * Header strip across breakpoints, stitched into one image.
 *
 * This exists because a wrapped "Get Early Access" pill ballooned into a blob
 * over the sign-out link at phone width, and it was sitting in plain sight in
 * a full-page screenshot that had already been reviewed — the eye goes to the
 * content that just changed, not the chrome that has "always been fine".
 * Chrome gets its own deliberate look now, at every width where it reflows.
 */
async function navStrip(pg, path, file, widths, label) {
  const shots = [];
  for (const width of widths) {
    await pg.setViewportSize({ width, height: 420 });
    await pg.goto(`http://localhost:8200${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await pg.waitForTimeout(900);
    const header = pg.locator("header");
    const box = await header.boundingBox();
    const buf = await pg.screenshot({
      clip: { x: 0, y: 0, width, height: Math.ceil((box?.height ?? 80) + 8) },
    });
    shots.push({ width, buf, h: Math.ceil((box?.height ?? 80) + 8) });
    // Flag the actual failure mode rather than trusting a later eyeball pass.
    const overflow = await pg.evaluate(() => {
      const n = document.querySelector("nav.wrap");
      const cta = document.querySelector(".nav-cta");
      const email = document.querySelector(".auth-email");
      const r = (el) => (el ? el.getBoundingClientRect() : null);
      const ctaR = r(cta);
      const emailR = r(email);
      // Scope to the nav: /account also has an .auth-input (display name).
      const input = document.querySelector("nav .auth-input");
      const inputR = r(input);
      // Count real rendered line boxes. Dividing height by a guessed
      // line-height counts the button's padding as an extra line and reports
      // a wrap at 1280px, which is nonsense.
      const lineCount = (el) => {
        if (!el) return 0;
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getClientRects().length;
      };
      return {
        navH: Math.round(r(n).height),
        ctaLines: lineCount(cta),
        ctaW: ctaR ? Math.round(ctaR.width) : 0,
        hasEmail: !!email,
        hasInput: !!input,
        inputW: inputR ? Math.round(inputR.width) : 0,
        emailW: emailR ? Math.round(emailR.width) : 0,
        bodyOverflowX:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      };
    });
    console.log(
      `  ${String(width).padStart(5)}px  navH=${String(overflow.navH).padStart(3)}  ` +
        `cta=${overflow.ctaW}w/${overflow.ctaLines}line(s)  email=${overflow.emailW}w  input=${overflow.inputW}w  ` +
        `hOverflow=${overflow.bodyOverflowX}`,
    );
    if (overflow.ctaLines > 1)
      errors.push(
        `nav-cta wrapped to ${overflow.ctaLines} lines at ${width}px`,
      );
    if (overflow.bodyOverflowX)
      errors.push(`[${label}] horizontal page overflow at ${width}px`);
    if (overflow.hasEmail && overflow.emailW === 0)
      errors.push(`[${label}] auth email collapsed to 0px at ${width}px`);
    // An email field narrower than this cannot show even a short address.
    if (overflow.hasInput && overflow.inputW < 120)
      errors.push(
        `[${label}] sign-in input only ${overflow.inputW}px at ${width}px`,
      );
  }
  // stitch vertically
  const totalH = shots.reduce((a, s2) => a + s2.h, 0);
  const maxW = Math.max(...shots.map((s2) => s2.width));
  const canvasPage = await pg.context().newPage();
  await canvasPage.setViewportSize({ width: maxW, height: totalH });
  const imgs = shots
    .map(
      (s2) =>
        `<div style="width:${s2.width}px"><img src="data:image/png;base64,${s2.buf.toString("base64")}" style="display:block;width:${s2.width}px"><div style="font:11px monospace;color:#c6a15b;padding:2px 6px">${s2.width}px</div></div>`,
    )
    .join("");
  await canvasPage.setContent(
    `<body style="margin:0;background:#0b0b0c">${imgs}</body>`,
  );
  await canvasPage.waitForTimeout(300);
  await canvasPage.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  await canvasPage.close();
  console.log(`${file} written`);
}

const WIDTHS = [1280, 900, 700, 560, 430, 390, 360];

console.log("\nheader across breakpoints (signed in):");
await navStrip(page, "/account", "shot-nav-widths.png", WIDTHS, "signed-in");

// The blob was a "Get Early Access" pill wrapping. That pill only renders when
// signed OUT now, so the signed-in strip above cannot exercise it — this
// second context (no seeded session) is what guards the original defect.
const ctxOut = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1.5,
});
await ctxOut.route("**/rest/v1/**", (route) =>
  route.fulfill({ contentType: "application/json", body: "[]" }),
);
const pageOut = await ctxOut.newPage();
pageOut.on("pageerror", (e) => errors.push(`[signed-out] ${e.message}`));
console.log("\nheader across breakpoints (signed out — CTA visible):");
await navStrip(
  pageOut,
  "/",
  "shot-nav-widths-signedout.png",
  WIDTHS,
  "signed-out",
);
await ctxOut.close();

applicationRow = null;
await tryShot("/apply", "shot-apply-form.png");
applicationRow = {
  id: "app-1",
  user_id: UID,
  artist_name: "Kite Season",
  city: "Lisbon",
  genre: "Alt R&B",
  links:
    "https://soundcloud.com/kiteseason\nhttps://open.spotify.com/artist/xxxx",
  about:
    "Two singles out, an EP mixed and waiting on masters. I've been selling out 200-cap rooms in Lisbon on word of mouth and want somewhere the people who found me first actually count for something.",
  status: "reviewing",
  created_at: "2026-07-26T11:20:00Z",
  review_notes: "",
};
await tryShot("/apply", "shot-apply-status.png");
applicationRow = null;

await tryShot("/account", "shot-account-desktop.png");
await tryShot("/dashboard", "shot-dashboard-desktop.png");
await tryShot("/artist/marra-vale", "shot-artist-desktop.png");
await tryShot("/discover", "shot-discover-desktop.png");
await tryShot("/account", "shot-account-mobile.png", { width: 390 });
await tryShot("/dashboard", "shot-dashboard-mobile.png", { width: 390 });

console.log("\nunmatched REST:", JSON.stringify([...new Set(unmatched)]));
console.log("pageerrors:", JSON.stringify(errors));
await browser.close();

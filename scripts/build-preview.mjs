import { readFileSync, writeFileSync } from "node:fs";

const dir =
  "/tmp/claude-0/-home-user-Unbeatable/4457052f-2c62-57b7-af72-dd7380031700/scratchpad";
const repo = "/workspace/nextup";
let css = readFileSync(`${repo}/css/styles.css`, "utf8");

// The artifact CSP blocks every external host, and there is no /fonts/ path to
// serve from either, so the self-hosted faces get inlined as data URIs. Without
// this the preview silently falls back to Arial and the redesign can't be
// judged — exactly what happened the first time the harness ran against the
// CDN-linked version.
css = css.replace(/url\("\/fonts\/([^"]+)"\)/g, (_, file) => {
  const b64 = readFileSync(`${repo}/public/fonts/${file}`).toString("base64");
  return `url(data:font/woff2;base64,${b64})`;
});

/**
 * Terms, Risk Disclosure and Privacy are generated from the React source
 * rather than hand-maintained a second time in the template.
 *
 * They are the longest pages on the site, they are the ones nobody re-reads,
 * and they are legal text — so a preview that quietly shows a stale version of
 * them is the worst kind of drift. Every other preview page is a hand-authored
 * mirror by necessity (they have state and behaviour); these three are pure
 * static content, so there is no excuse for a copy.
 *
 * The transform is deliberately narrow. It handles exactly the JSX these three
 * files use and throws otherwise, so a future page that needs more never fails
 * silently — it fails the build.
 */
function legalBodyFromSource(page) {
  const src = readFileSync(`${repo}/src/pages/${page}.jsx`, "utf8");
  const open = '<div className="wrap content-page">';
  const start = src.indexOf(open);
  if (start === -1) throw new Error(`${page}: content-page wrapper not found`);

  // Walk to the matching close so nested divs don't end the slice early.
  let depth = 0;
  let i = start;
  let end = -1;
  while (i < src.length) {
    const nextOpen = src.indexOf("<div", i);
    const nextClose = src.indexOf("</div>", i);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) {
        end = nextClose + "</div>".length;
        break;
      }
      i = nextClose + 6;
    }
  }
  if (end === -1) throw new Error(`${page}: unbalanced content-page wrapper`);

  let body = src.slice(start + open.length, end - "</div>".length);

  body = body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // JSX comments
    .replace(/\s*style=\{\{[^}]*\}\}/g, "") // inline styles; the sheet owns these now
    .replace(/<Link to="([^"]+)">/g, '<a href="#$1">')
    .replace(/<\/Link>/g, "</a>")
    .replace(/className=/g, "class=")
    .replace(/\{" "\}/g, " ");

  // Anything still holding a JSX expression would render as literal braces.
  const leftover = body.match(/\{[^}]*\}/);
  if (leftover) {
    throw new Error(
      `${page}: unconverted JSX expression ${JSON.stringify(leftover[0])} — ` +
        `extend legalBodyFromSource() rather than letting it ship`,
    );
  }

  return body.replace(/\s+/g, " ").trim();
}

const LEGAL = {
  "{{TERMS_BODY}}": legalBodyFromSource("Terms"),
  "{{RISK_BODY}}": legalBodyFromSource("RiskDisclosure"),
  "{{PRIVACY_BODY}}": legalBodyFromSource("Privacy"),
};

const template = readFileSync(`${dir}/preview-template.html`, "utf8");
const dataMin = JSON.stringify(
  JSON.parse(readFileSync(`${dir}/preview-data.json`, "utf8")),
);

function build(outfile, title, defaultRoute) {
  let html = template
    .split("{{CSS}}")
    .join(css)
    .split("{{DATA}}")
    .join(dataMin)
    .split("{{TITLE}}")
    .join(title)
    .split("{{DEFAULT_ROUTE}}")
    .join(defaultRoute);
  for (const [token, value] of Object.entries(LEGAL)) {
    if (!html.includes(token)) throw new Error(`template missing ${token}`);
    // JSON.stringify, not hand-quoting: the bodies are full of double quotes
    // (class="...", href="..."), and splicing them into a "..." literal broke
    // every route in the preview at once.
    html = html.split(token).join(JSON.stringify(value));
  }
  writeFileSync(`${dir}/${outfile}`, html);
  console.log(`${outfile}: ${(html.length / 1024).toFixed(0)} KB`);
}

build(
  "preview3_landing.html",
  "NEXTUP — Back artists before everyone else does",
  "/",
);
build("preview3_artist.html", "Artist — Nextup", "/artist/bruno-mars");

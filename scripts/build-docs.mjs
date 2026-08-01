/**
 * Renders the standalone HTML documents in docs/ into publishable files.
 *
 * `docs/founder-pack.html` and `docs/board-appendix.html` are deliverables that
 * go to people outside the repo, and both carry a `{{FONTS}}` token instead of
 * `@font-face` rules. Until this script existed that token was expanded by hand
 * at publish time, which meant the artifact anyone actually read could not be
 * reproduced from a commit — the exact drift risk the legal-body generator in
 * build-preview.mjs exists to prevent, one directory over.
 *
 * The faces are inlined as data URIs because the artifact host's CSP blocks
 * every external origin and there is no /fonts/ path to serve from. Without it
 * both documents fall back to Arial and read as drafts.
 *
 * Run: node scripts/build-docs.mjs [outDir]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] || join(repo, "dist", "docs");

// Pull the @font-face block straight out of the stylesheet rather than
// restating it here, so the documents can never disagree with the site about
// what the typeface is.
const css = readFileSync(join(repo, "css/styles.css"), "utf8");
const faces = css.match(/@font-face\s*\{[^}]*\}/g);
if (!faces || faces.length < 4) {
  throw new Error(
    `expected at least 4 @font-face rules in css/styles.css, found ${faces ? faces.length : 0}`,
  );
}

const fonts = faces
  .join("\n")
  .replace(/url\("\/fonts\/([^"]+)"\)/g, (_, file) => {
    const b64 = readFileSync(join(repo, "public/fonts", file)).toString(
      "base64",
    );
    return `url(data:font/woff2;base64,${b64})`;
  });

if (fonts.includes("/fonts/")) {
  throw new Error("a font URL survived inlining — it would 404 under the CSP");
}

mkdirSync(outDir, { recursive: true });

for (const name of ["founder-pack", "board-appendix"]) {
  const src = readFileSync(join(repo, "docs", `${name}.html`), "utf8");
  if (!src.includes("{{FONTS}}")) {
    throw new Error(`docs/${name}.html has no {{FONTS}} token`);
  }
  const html = src.split("{{FONTS}}").join(fonts);
  const out = join(outDir, `${name}.html`);
  writeFileSync(out, html);
  console.log(`${out}: ${(html.length / 1024).toFixed(0)} KB`);
}

import { Link } from "react-router-dom";
import { PageHero } from "../components/PageHero.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function NotFound() {
  usePageTitle("Page not found — Nextup");

  return (
    <main>
      <PageHero
        eyebrow="404"
        title="That page doesn't exist."
        style={{ borderBottom: "none" }}
      >
        <p>
          <Link to="/">Back to Nextup →</Link>
        </p>
      </PageHero>
    </main>
  );
}

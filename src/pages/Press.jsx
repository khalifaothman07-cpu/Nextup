import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { PageHero } from "../components/PageHero.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function Press() {
  usePageTitle("Press — Nextup");
  useReveal();

  return (
    <main>
      <Breadcrumb />

      <PageHero
        eyebrow="Press & media"
        title="Writing about Nextup?"
        style={{ borderBottom: "none" }}
      />

      <section style={{ borderBottom: "none", paddingTop: 0 }}>
        <div className="wrap">
          <div className="press-contact" data-reveal>
            <div>
              <h3>Get in touch</h3>
              <p>
                We're pre-launch and keeping details tight until early access
                opens — happy to talk to press under embargo. Reach out below.
              </p>
            </div>
            <a href="mailto:press@nextup.exchange" className="nav-cta">
              press@nextup.exchange
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

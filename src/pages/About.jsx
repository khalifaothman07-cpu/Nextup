import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function About() {
  usePageTitle("About — Nextup");
  useReveal();

  return (
    <main>
      <Breadcrumb />

      <section style={{ borderBottom: "none" }}>
        <div className="wrap">
          <div className="about-grid">
            <div className="about-copy" data-reveal>
              <div className="eyebrow">About Nextup</div>
              <h1
                style={{
                  fontSize: "clamp(32px, 4.8vw, 52px)",
                  margin: "16px 0 24px",
                }}
              >
                Built for the artists streaming still isn't paying.
              </h1>
              <p>
                Streaming pays artists fractions of a cent and pays the people
                who found them first nothing at all. Nextup asks the other
                question: what if getting there early counted for something?
              </p>
              <p>
                Global from day one. Everything settles in crypto — no borders,
                no banks, no waiting for a market to roll out to you.
              </p>
            </div>
            <div className="about-stats" data-reveal>
              <div className="about-stat">
                <div className="n">0%</div>
                <div className="l">Platform fee on anything you buy</div>
              </div>
              <div className="about-stat">
                <div className="n">$1</div>
                <div className="l">Minimum to back an artist</div>
              </div>
              <div className="about-stat">
                <div className="n">Worldwide</div>
                <div className="l">Crypto only, no borders</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

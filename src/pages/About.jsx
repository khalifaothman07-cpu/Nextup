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
                Most platforms let you stream an artist for free and give them
                fractions of a cent. Nextup asks a different question: what if
                the people who found an artist first could actually have a stake
                in what happens next?
              </p>
              <p>
                Nextup is global from day one and digital-native throughout —
                every backing and every song purchase settles in crypto, with no
                borders, no banks, and no waiting on a market to "roll out" to
                you. Discovery first, ownership second, streaming numbers a
                distant third.
              </p>
            </div>
            <div className="about-stats" data-reveal>
              <div className="about-stat">
                <div className="n">5</div>
                <div className="l">Artists on the platform at launch</div>
              </div>
              <div className="about-stat">
                <div className="n">$1</div>
                <div className="l">
                  Minimum to open a position backing an artist
                </div>
              </div>
              <div className="about-stat">
                <div className="n">Worldwide</div>
                <div className="l">Where Nextup is available</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

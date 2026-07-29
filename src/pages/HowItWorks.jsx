import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { PageHero } from "../components/PageHero.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function HowItWorks() {
  usePageTitle("How it works — Nextup");
  useReveal();

  const cardRef = useRef(null);
  const [spun, setSpun] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => setSpun(true), 500);
            io.disconnect();
          }
        });
      },
      { threshold: 0.5 },
    );
    io.observe(card);
    return () => io.disconnect();
  }, []);

  return (
    <main>
      <Breadcrumb />

      <PageHero eyebrow="How it actually works" title="Discover. Spin. Own.">
        <p>
          Three steps, in the order you'll actually use them — not a sales
          funnel dressed up as a process.
        </p>
      </PageHero>

      <section>
        <div className="wrap">
          <div className="flow">
            <div className="flow-item" data-reveal>
              <div className="fk">DISCOVER</div>
              <h3>Ranked by momentum, not marketing budget</h3>
              <p>
                Every week Nextup surfaces artists gaining real traction —
                plays, saves, show turnout — before a label's A&amp;R team ever
                sees the numbers.
              </p>
            </div>
            <div className="flow-item" data-reveal>
              <div className="fk">SPIN</div>
              <h3>Hear it before you back it</h3>
              <p>
                Each profile plays an artist's top three tracks on the spot.
                You're never deciding on a bio and a press photo alone.
              </p>
            </div>
            <div className="flow-item" data-reveal>
              <div className="fk">OWN</div>
              <h3>Back the artist, or own the song</h3>
              <p>
                Put money behind their career, or buy a specific track as a
                collectible. Either way, you were there before the rise — not
                after it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">Two ways in</div>
            <h2>Every record has two sides.</h2>
            <p>
              Nextup gives you the same choice — back the artist's whole career,
              or own one song outright. Full pricing for both:{" "}
              <Link to="/pricing">see pricing →</Link>
            </p>
          </div>
          <div className="sides" data-reveal>
            <div className="side a">
              <div className="letter">SIDE A</div>
              <h3>Back the Artist</h3>
              <p>
                Fund your Nextup wallet and open a position on an artist's live,
                continuously-priced bonding curve. As their catalogue and
                audience grow, your position moves with it.
              </p>
              <ul>
                <li>Tied to the artist, not one release</li>
                <li>No fixed tiers — trade in and out at the live price</li>
                <li>You show up on their page as an early backer</li>
              </ul>
            </div>
            <div className="side b">
              <div className="letter">SIDE B</div>
              <h3>Own the Song</h3>
              <p>
                Buy a specific track as a collectible, at a flat price the
                artist sets. It's yours — provably, permanently — whether or not
                the artist ever releases another one.
              </p>
              <ul>
                <li>Tied to one track, not the artist's future</li>
                <li>One-time price, set by the artist</li>
                <li>Your name in the credits, permanently</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section style={{ borderBottom: "none" }}>
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">See it live</div>
            <h2>Every profile plays before you decide.</h2>
            <p>
              This is a live preview of that exact screen — open a real artist
              profile to try it yourself.
            </p>
          </div>
          <div className="signature">
            <div
              className={`card${spun ? " spin" : ""}`}
              ref={cardRef}
              tabIndex={0}
              role="button"
              aria-label="Preview an artist profile"
              onClick={() => setSpun((s) => !s)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSpun((s) => !s);
                }
              }}
            >
              <div className="photo"></div>
              <div className="grad"></div>
              <div className="top">
                <div>
                  <div className="name">Marra Vale</div>
                  <div className="tag">R&amp;B / ALT · SÃO PAULO</div>
                </div>
                <div className="up">▲ 212%</div>
              </div>
              <div className="hint">Tap to preview profile</div>
              <div className="discs">
                <div className="disc-wrap">
                  <div className="disc"></div>
                  <span>Salt Water</span>
                </div>
                <div className="disc-wrap">
                  <div className="disc"></div>
                  <span>Low Tide</span>
                </div>
                <div className="disc-wrap">
                  <div className="disc"></div>
                  <span>25th &amp; Gray</span>
                </div>
              </div>
            </div>
            <div className="signature-copy" data-reveal>
              <div className="eyebrow">The moment</div>
              <h3>No streaming app detour, no guesswork.</h3>
              <p>
                You hear exactly what you'd be backing, right where you decide
                to back it.
              </p>
              <p className="muted">
                <Link to="/artist/marra-vale">
                  Open Marra Vale's real profile →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

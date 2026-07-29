import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { WaitlistForm } from "../components/WaitlistForm.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function Home() {
  usePageTitle("NEXTUP — Back artists before everyone else does");

  const cardRef = useRef(null);
  const [spun, setSpun] = useState(false);
  const [artists, setArtists] = useState(null);
  const [rosterError, setRosterError] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const timer = setTimeout(() => setSpun(true), 500);
            io.disconnect();
            return () => clearTimeout(timer);
          }
        });
      },
      { threshold: 0.5 },
    );
    io.observe(card);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("artists")
      .select("slug, name, genre, accent_from, accent_to, stat_30d_pct")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.length) {
          setRosterError(true);
        } else {
          setArtists(data);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useReveal([artists]);

  return (
    <main id="top">
      <section className="hero">
        <div className="hero-grain"></div>
        <div className="wrap hero-inner">
          <div className="eyebrow">Music, before the drop</div>
          <h1>
            Back artists <em>before</em> everyone else does.
          </h1>
          <p className="lede">
            Nextup surfaces unsigned and rising artists before the industry
            does. Back the ones you believe in — or own their songs outright —
            and hold a piece of what happens next.
          </p>
          <WaitlistForm source="hero" />
          <div className="fineprint">
            AVAILABLE WORLDWIDE — CRYPTO PAYMENTS ONLY
          </div>
        </div>
      </section>

      <section id="how">
        <div className="wrap">
          <div className="signature">
            <div
              className={`card${spun ? " spin" : ""}`}
              id="artistCard"
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
              <h3>Every artist has a profile that plays before you decide.</h3>
              <p>
                Open a profile and their three biggest tracks are already
                spinning. No streaming app detour, no guesswork — you hear
                exactly what you'd be backing, right where you decide to back
                it.
              </p>
              <p className="muted">
                This is a live preview of that exact screen.{" "}
                <Link to="/artist/marra-vale">
                  Open Marra Vale's real profile →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">Explore Nextup</div>
            <h2>Everything, one click deeper.</h2>
            <p>
              Each of these is its own full page — not a summary standing in for
              one.
            </p>
          </div>
          <div className="teaser-row" data-reveal style={{ marginBottom: 20 }}>
            <Link className="teaser-card" to="/how-it-works">
              <div className="tk">Product</div>
              <h3>How it works</h3>
              <p>
                Discover, spin, and the two ways to own a piece of an artist's
                rise.
              </p>
              <span className="go">Read more →</span>
            </Link>
            <Link className="teaser-card" to="/pricing">
              <div className="tk">Product</div>
              <h3>Pricing</h3>
              <p>
                No tiers — a flat price per song, live-priced backing, and the
                real minimums.
              </p>
              <span className="go">See pricing →</span>
            </Link>
            <Link className="teaser-card" to="/discover">
              <div className="tk">Product</div>
              <h3>Discover artists</h3>
              <p>The full roster, live from the platform.</p>
              <span className="go">Browse roster →</span>
            </Link>
          </div>
          <div className="teaser-row" data-reveal>
            <Link className="teaser-card" to="/about">
              <div className="tk">Company</div>
              <h3>About Nextup</h3>
              <p>Why we built this instead of another streaming app.</p>
              <span className="go">Read more →</span>
            </Link>
            <Link className="teaser-card" to="/faq">
              <div className="tk">Company</div>
              <h3>FAQ</h3>
              <p>
                Backing, ownership, deposits, withdrawals — answered plainly.
              </p>
              <span className="go">Read FAQ →</span>
            </Link>
            <Link className="teaser-card" to="/press">
              <div className="tk">Company</div>
              <h3>Press &amp; media</h3>
              <p>Writing about Nextup? Start here.</p>
              <span className="go">Get in touch →</span>
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">On Nextup right now</div>
            <h2>A few artists getting backed early.</h2>
            <p>
              <Link to="/discover">Browse the full roster →</Link>
            </p>
          </div>
          <div className={`roster-row${artists ? "" : " loading"}`} data-reveal>
            {artists
              ? artists.map((a) => (
                  <Link
                    key={a.slug}
                    className="rcard"
                    to={`/artist/${encodeURIComponent(a.slug)}`}
                  >
                    <div
                      className="swatch"
                      style={{
                        background: `linear-gradient(155deg,${a.accent_from},${a.accent_to})`,
                      }}
                    ></div>
                    <h4>{a.name}</h4>
                    <div className="genre">{a.genre.toUpperCase()}</div>
                    <div className="stat">
                      <span className="muted">30-day</span>
                      <span className="g">▲ {a.stat_30d_pct}%</span>
                    </div>
                  </Link>
                ))
              : rosterError
                ? "Roster is loading slowly — refresh in a moment."
                : "Loading roster…"}
          </div>
        </div>
      </section>

      <section className="band" id="waitlist">
        <div className="wrap">
          <div className="eyebrow" style={{ justifyContent: "center" }}>
            Limited early access
          </div>
          <h2 data-reveal>Get in before it's obvious.</h2>
          <WaitlistForm source="band" style={{ marginTop: 34 }} />
        </div>
      </section>
    </main>
  );
}

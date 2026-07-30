import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { fetchLatestMomentum } from "../lib/momentum.js";
import { ArtistCard } from "../components/ArtistCard.jsx";
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

  const [momentum, setMomentum] = useState(new Map());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from("artists")
        .select(
          "id, slug, name, genre, city, accent_from, accent_to, follower_count",
        )
        .order("sort_order", { ascending: true }),
      fetchLatestMomentum(),
    ]).then(([{ data, error }, momentumMap]) => {
      if (cancelled) return;
      if (error || !data?.length) {
        setRosterError(true);
      } else {
        setArtists(data);
        setMomentum(momentumMap);
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
            Find artists before the industry does. Back them, or own their songs
            outright.
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
                  <div className="name">Bruno Mars</div>
                  <div className="tag">Pop / Funk · Honolulu</div>
                </div>
                <div className="up">▲ 43</div>
              </div>
              <div className="hint">Tap to preview profile</div>
              <div className="discs">
                <div className="disc-wrap">
                  <div className="disc"></div>
                  <span>Die With A Smile</span>
                </div>
                <div className="disc-wrap">
                  <div className="disc"></div>
                  <span>Leave The Door Open</span>
                </div>
                <div className="disc-wrap">
                  <div className="disc"></div>
                  <span>Locked Out Of Heaven</span>
                </div>
              </div>
            </div>

            <div className="signature-copy" data-reveal>
              <div className="eyebrow">The moment</div>
              <h3>You hear it before you back it.</h3>
              <p>
                Open a profile and the tracks are already spinning — no
                streaming-app detour between hearing an artist and backing one.
              </p>
              <p className="muted">
                <Link to="/artist/bruno-mars">Open a real profile →</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <nav className="index-list" data-reveal aria-label="Site sections">
            <Link to="/how-it-works">
              <span>How it works</span>
              <em>Discover, back, own</em>
            </Link>
            <Link to="/pricing">
              <span>Pricing</span>
              <em>Flat per song, live-priced backing</em>
            </Link>
            <Link to="/discover">
              <span>Discover</span>
              <em>The full roster</em>
            </Link>
            <Link to="/apply">
              <span>Apply as an artist</span>
              <em>Pre-launch intake</em>
            </Link>
            <Link to="/about">
              <span>About</span>
              <em>Why we built this</em>
            </Link>
            <Link to="/faq">
              <span>FAQ</span>
              <em>Backing, ownership, withdrawals</em>
            </Link>
          </nav>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div className="eyebrow">On Nextup right now</div>
            <h2>Getting backed early.</h2>
            <p>
              <Link to="/discover">Browse the full roster →</Link>
            </p>
          </div>
          <div className={`roster-row${artists ? "" : " loading"}`} data-reveal>
            {artists
              ? artists.map((a) => (
                  <ArtistCard
                    key={a.id}
                    artist={a}
                    momentum={momentum.get(a.id)}
                  />
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

import { Link } from "react-router-dom";

/** Initials for the cartridge label — licensed artwork drops into the same slot. */
function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Roster cartridge (Home teaser row + Discover grid). Shows only real,
 * computed numbers: the trigger-maintained follower count and the daily
 * momentum score — never the seeded stat_30d_pct placeholder.
 */
export function ArtistCard({ artist, momentum }) {
  const score = momentum?.score ?? 0;
  return (
    <Link className="cart" to={`/artist/${encodeURIComponent(artist.slug)}`}>
      <div className="cart-ridge" aria-hidden="true"></div>
      <div className="cart-label">
        <div
          className="cart-art"
          style={{
            background: `linear-gradient(150deg,${artist.accent_from},${artist.accent_to})`,
          }}
        >
          <span aria-hidden="true">{initials(artist.name)}</span>
        </div>
        <h4>{artist.name}</h4>
        <div className="cart-meta">
          {artist.genre} · {artist.city}
        </div>
      </div>
      <div className="cart-foot">
        <span className="cart-followers">
          {(artist.follower_count ?? 0).toLocaleString("en-US")}
        </span>
        <span className={score > 0 ? "cart-score up" : "cart-score"}>
          ▲ {score}
        </span>
      </div>
      <div className="cart-pins" aria-hidden="true"></div>
    </Link>
  );
}

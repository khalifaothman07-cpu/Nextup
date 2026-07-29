import { Link } from "react-router-dom";

/**
 * Shared roster card (Home teaser row + Discover grid). Shows only real,
 * computed numbers: trigger-maintained follower count and the daily
 * momentum score — never the seeded stat_30d_pct placeholder.
 */
export function ArtistCard({ artist, momentum }) {
  const score = momentum?.score ?? 0;
  return (
    <Link className="rcard" to={`/artist/${encodeURIComponent(artist.slug)}`}>
      <div
        className="swatch"
        style={{
          background: `linear-gradient(155deg,${artist.accent_from},${artist.accent_to})`,
        }}
      ></div>
      <h4>{artist.name}</h4>
      <div className="genre">{artist.genre.toUpperCase()}</div>
      <div className="stat">
        <span className="muted">MOMENTUM 7D</span>
        <span className={score > 0 ? "g" : "muted"}>▲ {score}</span>
      </div>
      <div className="stat" style={{ marginTop: 6 }}>
        <span className="muted">FOLLOWERS</span>
        <span>{artist.follower_count ?? 0}</span>
      </div>
    </Link>
  );
}

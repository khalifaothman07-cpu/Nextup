import { Link } from "react-router-dom";

/**
 * Roster tile.
 *
 * Same rule as the artist page: the artist's hue owns the surface, the name
 * is set large in white on top of it, and the ghosted wordmark stands in for
 * the photograph until there is a licensed one to drop into the slot. A tile
 * is a small version of the page it opens, so hovering the roster reads as a
 * wall of artists rather than a grid of identical grey cards.
 */
export function ArtistCard({ artist, momentum }) {
  const score = momentum?.score ?? 0;
  return (
    <Link
      className="tile"
      to={`/artist/${encodeURIComponent(artist.slug)}`}
      style={{
        "--f-from": artist.accent_from,
        "--f-to": artist.accent_to,
      }}
    >
      <span className="tile-ghost" aria-hidden="true">
        {artist.name}
      </span>
      <span className="tile-meta">
        {artist.genre} · {artist.city}
      </span>
      <span className="tile-name">{artist.name}</span>
      <span className="tile-foot">
        <span>{(artist.follower_count ?? 0).toLocaleString("en-US")}</span>
        <span className="tile-score">▲ {score}</span>
      </span>
    </Link>
  );
}

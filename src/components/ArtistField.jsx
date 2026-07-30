/**
 * The artist's colour field.
 *
 * Both design references do the same thing: one saturated hue owns the whole
 * artist surface (Katy Perry hot pink, Pharrell lime, Nicki orange), the name
 * is set huge in white over it, and the artist's own image is the hero.
 *
 * We have no licensed photography, so the second reference supplies the
 * substitute — its giant ghosted "NEBULA" wordmark sitting behind everything
 * at very low contrast. Here that's the artist's own name, oversized and
 * bleeding off both edges. It fills the role a photograph would, honestly,
 * and the same slot takes a real image the day there's one to put in it.
 */
export function ArtistField({ artist, children }) {
  return (
    <section className="field">
      <div className="field-ghost" aria-hidden="true">
        {artist.name}
      </div>
      <div className="wrap field-inner">{children}</div>
    </section>
  );
}

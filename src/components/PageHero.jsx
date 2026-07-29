export function PageHero({ eyebrow, title, children, style }) {
  return (
    <section className="page-hero" style={style}>
      <div className="wrap">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  );
}

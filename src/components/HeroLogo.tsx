// Home hero illustration: the Nexus eagle mark, filling the frame. The mark is
// the real PNG (alpha knockout). The viewBox is cropped tight to the mark so it
// reads large. Decorative — aria-hidden in Home.

export function HeroLogo() {
  return (
    <svg viewBox="20 67 489 365" role="img" aria-label="The Nexus eagle mark">
      {/* The Nexus eagle mark (viewBox crops to its content) — 2x for crisp edges */}
      <image className="hero-logo-mark" href="/nexus-mark@2x.png" x="0" y="0" width="512" height="512" />
    </svg>
  );
}

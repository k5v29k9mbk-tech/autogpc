// The Nexus mark, rendered white. The source PNG is an alpha knockout, so we
// use it as a mask and fill it with the near-white text color — keeping the
// real mark shape while reading as a clean white logo on the dark shell.

export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Nexus"
      className={className}
      style={{
        display: "block",
        width: size,
        height: size,
        background: "var(--text)",
        WebkitMaskImage: "url(/nexus-mark.png)",
        maskImage: "url(/nexus-mark.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

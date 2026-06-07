// One-time asset generation. Reads the supplied dark-hawk-on-cream mark and
// emits:
//   public/nexus-mark.png   cream knockout on transparent  (for dark UI)
//   public/favicon.png      cream mark on dark tile, 256px  (browser tab)
//   public/apple-touch-icon.png  cream mark on dark tile, 180px
//
// The favicon/touch tiles match the on-site logo: the cream mark, centered
// with breathing room, on the near-black app background.
//
// Run with:  npm run gen:logo
// Outputs are committed, so the app build does not depend on this script.

import Jimp from "jimp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../assets/nexus-source.png");
const PUBLIC = resolve(here, "../public");

// Cream the hawk is recolored to on dark backgrounds (matches --text).
const CREAM = { r: 0xec, g: 0xe7, b: 0xda };
// Near-black app background (matches --bg) for the favicon tile.
const BG = Jimp.rgbaToInt(0x0a, 0x0a, 0x0a, 0xff);

// Map luminance -> alpha so edges stay anti-aliased.
//   lum <= DARK  => fully opaque ink (the hawk)
//   lum >= LIGHT => fully transparent (the cream paper)
const DARK = 110;
const LIGHT = 205;

function alphaForLum(lum) {
  if (lum <= DARK) return 255;
  if (lum >= LIGHT) return 0;
  return Math.round(255 * (1 - (lum - DARK) / (LIGHT - DARK)));
}

async function run() {
  const src = await Jimp.read(SRC);

  // --- knockout (cream on transparent) ---
  let mark = src.clone();
  mark.scan(0, 0, mark.bitmap.width, mark.bitmap.height, function (_x, _y, idx) {
    const d = this.bitmap.data;
    const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
    d[idx] = CREAM.r;
    d[idx + 1] = CREAM.g;
    d[idx + 2] = CREAM.b;
    d[idx + 3] = alphaForLum(lum);
  });

  // The source has generous transparent padding, which left the rendered mark
  // looking small and floaty. Trim it to the hawk's bounding box, then re-pad
  // to a square with only a sliver of breathing room (MARGIN) so the mark
  // nearly fills its square box wherever it's drawn with `contain`.
  mark.autocrop();
  const MARGIN = 0.05; // fraction of the longer side
  const longest = Math.max(mark.bitmap.width, mark.bitmap.height);
  const box = Math.round(longest * (1 + MARGIN * 2));
  const squared = new Jimp(box, box, 0x00000000);
  squared.composite(
    mark,
    Math.round((box - mark.bitmap.width) / 2),
    Math.round((box - mark.bitmap.height) / 2),
  );
  mark = squared;

  await mark.clone().resize(512, 512).writeAsync(resolve(PUBLIC, "nexus-mark.png"));

  // --- favicon + apple touch ---
  // `contain` preserves the mark's shape inside the box. padRatio is the total
  // padding fraction (smaller = bigger mark).
  const tile = (size, bg, padRatio) => {
    const t = new Jimp(size, size, bg);
    const inner = Math.round(size * (1 - padRatio));
    const m = mark.clone().contain(inner, inner);
    const offset = Math.round((size - inner) / 2);
    t.composite(m, offset, offset);
    return t;
  };

  // favicon: large cream mark on a transparent background (no tile).
  await tile(256, 0x00000000, 0.08).writeAsync(resolve(PUBLIC, "favicon.png"));
  // apple touch: needs an opaque tile (iOS masks it), so keep the dark bg.
  await tile(180, BG, 0.18).writeAsync(resolve(PUBLIC, "apple-touch-icon.png"));

  console.log("Logo assets written to public/: nexus-mark.png, favicon.png, apple-touch-icon.png");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

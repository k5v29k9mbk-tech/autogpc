// One-time asset generation. Reads the supplied dark-hawk-on-cream mark and
// emits:
//   public/nexus-mark.png   cream knockout on transparent  (for dark UI)
//   public/favicon.png      dark mark on cream tile, 256px  (browser tab)
//   public/apple-touch-icon.png  180px tile
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
const CREAM = { r: 0xf4, g: 0xef, b: 0xe3 };

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
  const mark = src.clone();
  mark.scan(0, 0, mark.bitmap.width, mark.bitmap.height, function (_x, _y, idx) {
    const d = this.bitmap.data;
    const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
    d[idx] = CREAM.r;
    d[idx + 1] = CREAM.g;
    d[idx + 2] = CREAM.b;
    d[idx + 3] = alphaForLum(lum);
  });
  mark.resize(512, Jimp.AUTO);
  await mark.writeAsync(resolve(PUBLIC, "nexus-mark.png"));

  // --- favicon + apple touch (original tile, just resized) ---
  const favicon = src.clone().resize(256, 256);
  await favicon.writeAsync(resolve(PUBLIC, "favicon.png"));

  const touch = src.clone().resize(180, 180);
  await touch.writeAsync(resolve(PUBLIC, "apple-touch-icon.png"));

  console.log("Logo assets written to public/: nexus-mark.png, favicon.png, apple-touch-icon.png");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

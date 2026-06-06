// preprocessImage — the single biggest quality lever for the open-source OCR
// path. Faded thermal receipts and skewed scans read far better after a
// grayscale -> upscale -> contrast -> binarize pass.
//
// Browser canvas based. Kept small and side-effect-free (returns a fresh
// canvas) so it is easy to reason about and reuse. Deskew is intentionally
// left as a documented stop (see below) — it is the lowest-yield step and the
// hardest to get right without introducing artefacts.

export type PreprocessOptions = {
  /** Upscale until the longest edge reaches at least this many pixels. */
  targetLongEdge?: number;
  /** Contrast multiplier applied around mid-grey before binarizing. */
  contrast?: number;
};

const DEFAULTS: Required<PreprocessOptions> = {
  targetLongEdge: 1600,
  contrast: 1.35,
};

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob);
  }
  // Fallback for environments without createImageBitmap.
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = url;
    });
    return img;
  } finally {
    // Revoke on the next tick so the decode has completed.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function dimensions(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if ("width" in src && "height" in src) {
    const w = (src as ImageBitmap).width || (src as HTMLImageElement).naturalWidth;
    const h = (src as ImageBitmap).height || (src as HTMLImageElement).naturalHeight;
    return { w, h };
  }
  return { w: 0, h: 0 };
}

function otsuThreshold(gray: Uint8ClampedArray): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i += 4) hist[gray[i]]++;
  const total = gray.length / 4;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Returns a binarized, upscaled, high-contrast canvas ready to hand to
 * Tesseract. The original blob is never mutated.
 */
export async function preprocessImage(
  blob: Blob,
  options: PreprocessOptions = {},
): Promise<HTMLCanvasElement> {
  const opts = { ...DEFAULTS, ...options };
  const src = await loadBitmap(blob);
  const { w, h } = dimensions(src);
  if (!w || !h) throw new Error("Image has no dimensions");

  const longEdge = Math.max(w, h);
  const scale = longEdge < opts.targetLongEdge ? Math.min(3, opts.targetLongEdge / longEdge) : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get a 2D canvas context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src as CanvasImageSource, 0, 0, canvas.width, canvas.height);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  // 1. Grayscale (luminance) + 2. contrast around mid-grey.
  const c = opts.contrast;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let v = (lum - 128) * c + 128;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    data[i] = data[i + 1] = data[i + 2] = v;
  }

  // 3. Adaptive global threshold (Otsu) -> binarize to black/white.
  const threshold = otsuThreshold(data);
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }

  ctx.putImageData(image, 0, 0);

  if ("close" in src && typeof src.close === "function") {
    (src as ImageBitmap).close();
  }
  return canvas;
}

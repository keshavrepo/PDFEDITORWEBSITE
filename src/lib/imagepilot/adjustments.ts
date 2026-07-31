/**
 * ImagePilot pixel pipeline.
 *
 * Pure functions over RGBA byte arrays. Nothing here touches the DOM, so the
 * exact code the editor runs in the browser is also exercised headlessly by
 * the test suite.
 *
 * The pipeline is ordered the way a photographer works:
 *
 *   1. noise reduction  — clean the signal before anything amplifies it
 *   2. blur             — spatial softening
 *   3. tone curve       — exposure, gamma, brightness, contrast, shadows,
 *                         highlights, temperature and tint, collapsed into one
 *                         256-entry lookup table per channel
 *   4. colour matrix    — saturation, hue, grayscale, sepia and invert,
 *                         composed into a single 3×4 affine matrix
 *   5. threshold        — non-linear, so it has to come last
 *   6. sharpen          — applied after tone work so it does not amplify the
 *                         halos the tone curve would otherwise create
 *
 * Collapsing steps 3 and 4 means a full-frame edit costs two passes rather
 * than a dozen, which is what keeps slider dragging interactive on large
 * images.
 */

import {
  MAX_BLUR_RADIUS,
  MAX_SHARPEN_RADIUS,
} from "./constants";
import { defaultAdjustments, type Adjustments } from "./types";

/** Rec.709 luminance weights, matching what browsers use for `filter`. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

export function createAdjustments(overrides: Partial<Adjustments> = {}): Adjustments {
  return { ...defaultAdjustments, ...overrides };
}

/** True when at least one adjustment differs from its neutral value. */
export function hasAdjustments(a: Adjustments): boolean {
  return (
    a.brightness !== 0 ||
    a.contrast !== 0 ||
    a.saturation !== 0 ||
    a.hue !== 0 ||
    a.exposure !== 0 ||
    a.temperature !== 0 ||
    a.tint !== 0 ||
    a.gamma !== 1 ||
    a.shadows !== 0 ||
    a.highlights !== 0 ||
    a.blur > 0 ||
    a.sharpen > 0 ||
    a.grayscale > 0 ||
    a.invert > 0 ||
    a.sepia > 0 ||
    a.thresholdEnabled ||
    a.noiseReduction > 0 ||
    a.pixelate > 0
  );
}

/** True when the adjustment needs neighbouring pixels (and so a full buffer). */
export function hasSpatialAdjustments(a: Adjustments): boolean {
  return a.blur > 0 || a.sharpen > 0 || a.noiseReduction > 0 || a.pixelate > 0;
}

/**
 * Stable identity for a set of adjustments.
 *
 * Used as a cache key so a re-render with unchanged values reuses the previous
 * raster instead of recomputing it.
 */
export function adjustmentsKey(a: Adjustments): string {
  if (!hasAdjustments(a)) return "none";
  return [
    a.brightness,
    a.contrast,
    a.saturation,
    a.hue,
    a.exposure,
    a.temperature,
    a.tint,
    a.gamma,
    a.shadows,
    a.highlights,
    a.blur,
    a.sharpen,
    a.grayscale,
    a.invert,
    a.sepia,
    a.thresholdEnabled ? a.threshold : "x",
    a.noiseReduction,
    a.pixelate,
  ].join(",");
}

/* -------------------------------------------------------------------------- */
/* Tone curve                                                                 */
/* -------------------------------------------------------------------------- */

const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return c;
}

/**
 * Smooth weighting for the shadow and highlight controls.
 *
 * A hard split at mid grey produces a visible band, so each control fades out
 * with a cubic falloff across its half of the range.
 */
function shadowWeight(v: number): number {
  // 1 at black, 0 at mid grey and above.
  const t = Math.max(0, 1 - v * 2);
  return t * t;
}

function highlightWeight(v: number): number {
  // 1 at white, 0 at mid grey and below.
  const t = Math.max(0, v * 2 - 1);
  return t * t;
}

/**
 * Per-channel gains approximating a white-balance shift.
 *
 * Temperature moves along the blue/amber axis and tint along the green/magenta
 * axis, which is how every raw editor labels the two controls.
 */
function whiteBalanceGains(temperature: number, tint: number): [number, number, number] {
  const t = temperature / 100;
  const g = tint / 100;
  return [
    1 + t * 0.28 + g * 0.06,
    1 - Math.abs(t) * 0.04 - g * 0.16,
    1 - t * 0.28 + g * 0.1,
  ];
}

/**
 * Builds one 256-entry lookup table per channel covering every tone control.
 *
 * Exposure and gamma are applied in linear light because that is where they
 * are physically meaningful; the remaining controls are perceptual and stay in
 * sRGB.
 */
export function buildToneLuts(a: Adjustments): [Uint8ClampedArray, Uint8ClampedArray, Uint8ClampedArray] {
  const exposureGain = Math.pow(2, a.exposure);
  const invGamma = 1 / Math.max(0.01, a.gamma);
  const brightness = a.brightness / 100;
  // Maps -100..100 onto a 0..~4 slope, with 1 at the neutral position.
  const contrast = a.contrast >= 0 ? 1 + (a.contrast / 100) * 3 : 1 + a.contrast / 100;
  const shadowAmount = a.shadows / 100;
  const highlightAmount = a.highlights / 100;
  const [gainR, gainG, gainB] = whiteBalanceGains(a.temperature, a.tint);
  const gains = [gainR, gainG, gainB];

  const luts: [Uint8ClampedArray, Uint8ClampedArray, Uint8ClampedArray] = [
    new Uint8ClampedArray(256),
    new Uint8ClampedArray(256),
    new Uint8ClampedArray(256),
  ];

  for (let channel = 0; channel < 3; channel++) {
    const lut = luts[channel];
    const gain = gains[channel];

    for (let i = 0; i < 256; i++) {
      // Exposure and gamma in linear light.
      let linear = SRGB_TO_LINEAR[i] * exposureGain;
      if (invGamma !== 1) linear = Math.pow(Math.max(0, linear), invGamma);
      let v = linearToSrgb(Math.max(0, linear));

      // Tone controls in perceptual space.
      if (brightness !== 0) v += brightness;
      if (contrast !== 1) v = (v - 0.5) * contrast + 0.5;

      if (shadowAmount !== 0) {
        // Lifting shadows must not touch anything already near white.
        v += shadowAmount * 0.55 * shadowWeight(Math.min(1, Math.max(0, v)));
      }
      if (highlightAmount !== 0) {
        v += highlightAmount * 0.55 * highlightWeight(Math.min(1, Math.max(0, v)));
      }

      if (gain !== 1) v *= gain;

      lut[i] = Math.round(v * 255);
    }
  }

  return luts;
}

/* -------------------------------------------------------------------------- */
/* Colour matrix                                                              */
/* -------------------------------------------------------------------------- */

/** Row-major 3×4 affine colour matrix: [r,g,b,offset] per output channel. */
export type ColorMatrix = Float64Array;

function identityMatrix(): ColorMatrix {
  const m = new Float64Array(12);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  return m;
}

/** Returns `a ∘ b`, i.e. apply `b` first and then `a`. */
function composeMatrix(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const out = new Float64Array(12);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[row * 4 + col] =
        a[row * 4] * b[col] +
        a[row * 4 + 1] * b[4 + col] +
        a[row * 4 + 2] * b[8 + col];
    }
    out[row * 4 + 3] =
      a[row * 4] * b[3] +
      a[row * 4 + 1] * b[7] +
      a[row * 4 + 2] * b[11] +
      a[row * 4 + 3];
  }
  return out;
}

/** Linear blend between the identity matrix and `target`. */
function lerpToIdentity(target: ColorMatrix, amount: number): ColorMatrix {
  const identity = identityMatrix();
  const out = new Float64Array(12);
  for (let i = 0; i < 12; i++) {
    out[i] = identity[i] * (1 - amount) + target[i] * amount;
  }
  return out;
}

function saturationMatrix(saturation: number): ColorMatrix {
  // -100 → fully desaturated, 0 → unchanged, +100 → double saturation.
  const s = saturation >= 0 ? 1 + saturation / 100 : 1 + saturation / 100;
  const m = new Float64Array(12);
  const inv = 1 - s;
  m[0] = inv * LUMA_R + s;
  m[1] = inv * LUMA_G;
  m[2] = inv * LUMA_B;
  m[4] = inv * LUMA_R;
  m[5] = inv * LUMA_G + s;
  m[6] = inv * LUMA_B;
  m[8] = inv * LUMA_R;
  m[9] = inv * LUMA_G;
  m[10] = inv * LUMA_B + s;
  return m;
}

function hueMatrix(degrees: number): ColorMatrix {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const m = new Float64Array(12);
  // The standard feColorMatrix `hueRotate` construction.
  m[0] = 0.213 + cos * 0.787 - sin * 0.213;
  m[1] = 0.715 - cos * 0.715 - sin * 0.715;
  m[2] = 0.072 - cos * 0.072 + sin * 0.928;
  m[4] = 0.213 - cos * 0.213 + sin * 0.143;
  m[5] = 0.715 + cos * 0.285 + sin * 0.14;
  m[6] = 0.072 - cos * 0.072 - sin * 0.283;
  m[8] = 0.213 - cos * 0.213 - sin * 0.787;
  m[9] = 0.715 - cos * 0.715 + sin * 0.715;
  m[10] = 0.072 + cos * 0.928 + sin * 0.072;
  return m;
}

function grayscaleMatrix(): ColorMatrix {
  const m = new Float64Array(12);
  for (let row = 0; row < 3; row++) {
    m[row * 4] = LUMA_R;
    m[row * 4 + 1] = LUMA_G;
    m[row * 4 + 2] = LUMA_B;
  }
  return m;
}

function sepiaMatrix(): ColorMatrix {
  const m = new Float64Array(12);
  m[0] = 0.393; m[1] = 0.769; m[2] = 0.189;
  m[4] = 0.349; m[5] = 0.686; m[6] = 0.168;
  m[8] = 0.272; m[9] = 0.534; m[10] = 0.131;
  return m;
}

function invertMatrix(): ColorMatrix {
  const m = new Float64Array(12);
  m[0] = -1; m[3] = 1;
  m[5] = -1; m[7] = 1;
  m[10] = -1; m[11] = 1;
  return m;
}

/** True when the matrix is close enough to the identity to skip the pass. */
function isIdentityMatrix(m: ColorMatrix): boolean {
  const identity = identityMatrix();
  for (let i = 0; i < 12; i++) {
    if (Math.abs(m[i] - identity[i]) > 1e-6) return false;
  }
  return true;
}

/** Composes every colour operation into one matrix. */
export function buildColorMatrix(a: Adjustments): ColorMatrix | null {
  let m = identityMatrix();

  if (a.saturation !== 0) m = composeMatrix(saturationMatrix(a.saturation), m);
  if (a.hue !== 0) m = composeMatrix(hueMatrix(a.hue), m);
  if (a.grayscale > 0) m = composeMatrix(lerpToIdentity(grayscaleMatrix(), a.grayscale / 100), m);
  if (a.sepia > 0) m = composeMatrix(lerpToIdentity(sepiaMatrix(), a.sepia / 100), m);
  if (a.invert > 0) m = composeMatrix(lerpToIdentity(invertMatrix(), a.invert / 100), m);

  return isIdentityMatrix(m) ? null : m;
}

/* -------------------------------------------------------------------------- */
/* Spatial filters                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Box-blur radii whose sum approximates a true Gaussian.
 *
 * Three box passes converge on a Gaussian to within a couple of percent, at a
 * fraction of the cost of an actual convolution. The classic derivation from
 * Kovesi's "Fast Almost-Gaussian Filtering" is used to pick the radii.
 */
function boxRadiiForGaussian(sigma: number, passes = 3): number[] {
  const idealWidth = Math.sqrt((12 * sigma * sigma) / passes + 1);
  let wl = Math.floor(idealWidth);
  if (wl % 2 === 0) wl -= 1;
  const wu = wl + 2;
  const mIdeal =
    (12 * sigma * sigma - passes * wl * wl - 4 * passes * wl - 3 * passes) /
    (-4 * wl - 4);
  const m = Math.round(mIdeal);

  const radii: number[] = [];
  for (let i = 0; i < passes; i++) {
    radii.push(((i < m ? wl : wu) - 1) / 2);
  }
  return radii;
}

/** One horizontal box pass over premultiplied RGBA. */
function boxBlurHorizontal(
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number,
  radius: number
): void {
  if (radius < 1) {
    dst.set(src);
    return;
  }
  const window = radius * 2 + 1;
  const scale = 1 / window;

  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumA = 0;

    // Seed the running sum with the clamped left edge.
    for (let i = -radius; i <= radius; i++) {
      const x = Math.min(width - 1, Math.max(0, i));
      const p = row + x * 4;
      sumR += src[p];
      sumG += src[p + 1];
      sumB += src[p + 2];
      sumA += src[p + 3];
    }

    for (let x = 0; x < width; x++) {
      const p = row + x * 4;
      dst[p] = sumR * scale;
      dst[p + 1] = sumG * scale;
      dst[p + 2] = sumB * scale;
      dst[p + 3] = sumA * scale;

      const outX = Math.min(width - 1, Math.max(0, x - radius));
      const inX = Math.min(width - 1, Math.max(0, x + radius + 1));
      const outP = row + outX * 4;
      const inP = row + inX * 4;
      sumR += src[inP] - src[outP];
      sumG += src[inP + 1] - src[outP + 1];
      sumB += src[inP + 2] - src[outP + 2];
      sumA += src[inP + 3] - src[outP + 3];
    }
  }
}

/** One vertical box pass over premultiplied RGBA. */
function boxBlurVertical(
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number,
  radius: number
): void {
  if (radius < 1) {
    dst.set(src);
    return;
  }
  const window = radius * 2 + 1;
  const scale = 1 / window;
  const stride = width * 4;

  for (let x = 0; x < width; x++) {
    const col = x * 4;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumA = 0;

    for (let i = -radius; i <= radius; i++) {
      const y = Math.min(height - 1, Math.max(0, i));
      const p = y * stride + col;
      sumR += src[p];
      sumG += src[p + 1];
      sumB += src[p + 2];
      sumA += src[p + 3];
    }

    for (let y = 0; y < height; y++) {
      const p = y * stride + col;
      dst[p] = sumR * scale;
      dst[p + 1] = sumG * scale;
      dst[p + 2] = sumB * scale;
      dst[p + 3] = sumA * scale;

      const outY = Math.min(height - 1, Math.max(0, y - radius));
      const inY = Math.min(height - 1, Math.max(0, y + radius + 1));
      const outP = outY * stride + col;
      const inP = inY * stride + col;
      sumR += src[inP] - src[outP];
      sumG += src[inP + 1] - src[outP + 1];
      sumB += src[inP + 2] - src[outP + 2];
      sumA += src[inP + 3] - src[outP + 3];
    }
  }
}

/**
 * Gaussian blur over RGBA bytes.
 *
 * Alpha is premultiplied first, otherwise fully transparent pixels (which are
 * usually transparent *black*) bleed dark fringes into the visible edges.
 */
export function gaussianBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sigma: number
): void {
  if (sigma <= 0 || width < 1 || height < 1) return;

  const count = width * height * 4;
  let buffer = new Float32Array(count);
  let scratch = new Float32Array(count);

  for (let i = 0; i < count; i += 4) {
    const alpha = data[i + 3] / 255;
    buffer[i] = data[i] * alpha;
    buffer[i + 1] = data[i + 1] * alpha;
    buffer[i + 2] = data[i + 2] * alpha;
    buffer[i + 3] = data[i + 3];
  }

  for (const radius of boxRadiiForGaussian(sigma)) {
    boxBlurHorizontal(buffer, scratch, width, height, radius);
    boxBlurVertical(scratch, buffer, width, height, radius);
  }

  for (let i = 0; i < count; i += 4) {
    const alpha = buffer[i + 3];
    data[i + 3] = alpha;
    if (alpha <= 0) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      continue;
    }
    const inv = 255 / alpha;
    data[i] = buffer[i] * inv;
    data[i + 1] = buffer[i + 1] * inv;
    data[i + 2] = buffer[i + 2] * inv;
  }

  // Release the large scratch buffers promptly on long editing sessions.
  buffer = new Float32Array(0);
  scratch = new Float32Array(0);
}

/**
 * Unsharp mask.
 *
 * The blurred copy is subtracted from the original and the difference is added
 * back, which is the standard way to sharpen without introducing the ringing a
 * plain convolution kernel produces.
 */
export function unsharpMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
  radius: number
): void {
  if (amount <= 0 || radius <= 0) return;

  const blurred = new Uint8ClampedArray(data);
  gaussianBlur(blurred, width, height, radius);

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const original = data[i + c];
      data[i + c] = original + amount * (original - blurred[i + c]);
    }
  }
}

/** Sorting network computing the median of nine values in place. */
function median9(v: number[]): number {
  // 19-comparison network; faster and allocation-free compared with sorting.
  const swap = (a: number, b: number) => {
    if (v[a] > v[b]) {
      const t = v[a];
      v[a] = v[b];
      v[b] = t;
    }
  };
  swap(1, 2); swap(4, 5); swap(7, 8);
  swap(0, 1); swap(3, 4); swap(6, 7);
  swap(1, 2); swap(4, 5); swap(7, 8);
  swap(0, 3); swap(5, 8); swap(4, 7);
  swap(3, 6); swap(1, 4); swap(2, 5);
  swap(4, 7); swap(4, 2); swap(6, 4);
  swap(4, 2);
  return v[4];
}

/**
 * Mosaic (pixelate) filter.
 *
 * Averages each cell and writes the mean back across the whole cell. Unlike a
 * blur this is genuinely irreversible once flattened, which is why redaction
 * work in the screenshot editor uses it rather than a heavy blur: a blurred
 * region can often be recovered by deconvolution, an averaged block cannot.
 *
 * Alpha is averaged alongside colour so the filter behaves correctly on
 * partially transparent layers, and colour is weighted by alpha so fully
 * transparent pixels contribute no colour to the cell mean.
 */
export function pixelate(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cellSize: number
): void {
  const cell = Math.max(1, Math.round(cellSize));
  if (cell <= 1 || width < 1 || height < 1) return;

  for (let cellY = 0; cellY < height; cellY += cell) {
    const maxY = Math.min(cellY + cell, height);

    for (let cellX = 0; cellX < width; cellX += cell) {
      const maxX = Math.min(cellX + cell, width);

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      let weight = 0;
      let count = 0;

      for (let y = cellY; y < maxY; y++) {
        for (let x = cellX; x < maxX; x++) {
          const index = (y * width + x) * 4;
          const alpha = data[index + 3];
          // Weighting by alpha stops transparent black dragging the mean down.
          sumR += data[index] * alpha;
          sumG += data[index + 1] * alpha;
          sumB += data[index + 2] * alpha;
          sumA += alpha;
          weight += alpha;
          count++;
        }
      }

      if (!count) continue;

      const meanA = sumA / count;
      const meanR = weight > 0 ? sumR / weight : 0;
      const meanG = weight > 0 ? sumG / weight : 0;
      const meanB = weight > 0 ? sumB / weight : 0;

      for (let y = cellY; y < maxY; y++) {
        for (let x = cellX; x < maxX; x++) {
          const index = (y * width + x) * 4;
          data[index] = meanR;
          data[index + 1] = meanG;
          data[index + 2] = meanB;
          data[index + 3] = meanA;
        }
      }
    }
  }
}

/**
 * Edge-preserving noise reduction via a 3×3 median filter.
 *
 * A median removes speckle and sensor noise without the edge smearing a mean
 * filter causes, which is why it is the right primitive here rather than
 * simply reusing the blur.
 */
export function medianDenoise(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number
): void {
  if (strength <= 0 || width < 3 || height < 3) return;

  // Above the halfway mark a second pass is run, which is what separates
  // "clean up JPEG artefacts" from "salvage a noisy night shot".
  const passes = strength > 50 ? 2 : 1;
  const blend = Math.min(1, strength / 50);

  for (let pass = 0; pass < passes; pass++) {
    const source = new Uint8ClampedArray(data);
    const window = new Array<number>(9);

    for (let y = 0; y < height; y++) {
      const y0 = Math.max(0, y - 1);
      const y1 = y;
      const y2 = Math.min(height - 1, y + 1);

      for (let x = 0; x < width; x++) {
        const x0 = Math.max(0, x - 1);
        const x1 = x;
        const x2 = Math.min(width - 1, x + 1);
        const target = (y * width + x) * 4;

        // Alpha is left alone: filtering it would erode cut-out edges.
        for (let c = 0; c < 3; c++) {
          window[0] = source[(y0 * width + x0) * 4 + c];
          window[1] = source[(y0 * width + x1) * 4 + c];
          window[2] = source[(y0 * width + x2) * 4 + c];
          window[3] = source[(y1 * width + x0) * 4 + c];
          window[4] = source[(y1 * width + x1) * 4 + c];
          window[5] = source[(y1 * width + x2) * 4 + c];
          window[6] = source[(y2 * width + x0) * 4 + c];
          window[7] = source[(y2 * width + x1) * 4 + c];
          window[8] = source[(y2 * width + x2) * 4 + c];

          const filtered = median9(window);
          const original = source[target + c];
          data[target + c] = original + (filtered - original) * blend;
        }
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Pipeline                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Applies every adjustment to an RGBA buffer, in place.
 *
 * `scale` lets a preview render at reduced resolution while keeping spatial
 * radii visually identical to the full-size result — without it, a blur would
 * look far stronger in a zoomed-out preview than in the export.
 */
export function applyAdjustments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  a: Adjustments,
  scale = 1
): void {
  if (!hasAdjustments(a) || width < 1 || height < 1) return;

  if (a.noiseReduction > 0) {
    medianDenoise(data, width, height, a.noiseReduction);
  }

  if (a.blur > 0) {
    // Sigma is a third of the radius, the usual "three sigma covers the
    // kernel" convention.
    const radius = (a.blur / 100) * MAX_BLUR_RADIUS * scale;
    gaussianBlur(data, width, height, radius / 3);
  }

  const luts = buildToneLuts(a);
  const needsLut =
    a.exposure !== 0 ||
    a.gamma !== 1 ||
    a.brightness !== 0 ||
    a.contrast !== 0 ||
    a.shadows !== 0 ||
    a.highlights !== 0 ||
    a.temperature !== 0 ||
    a.tint !== 0;

  if (needsLut) {
    const [lutR, lutG, lutB] = luts;
    for (let i = 0; i < data.length; i += 4) {
      // Fully transparent pixels carry no colour worth transforming.
      if (data[i + 3] === 0) continue;
      data[i] = lutR[data[i]];
      data[i + 1] = lutG[data[i + 1]];
      data[i + 2] = lutB[data[i + 2]];
    }
  }

  const matrix = buildColorMatrix(a);
  if (matrix) {
    const m0 = matrix[0], m1 = matrix[1], m2 = matrix[2], m3 = matrix[3] * 255;
    const m4 = matrix[4], m5 = matrix[5], m6 = matrix[6], m7 = matrix[7] * 255;
    const m8 = matrix[8], m9 = matrix[9], m10 = matrix[10], m11 = matrix[11] * 255;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      data[i] = r * m0 + g * m1 + b * m2 + m3;
      data[i + 1] = r * m4 + g * m5 + b * m6 + m7;
      data[i + 2] = r * m8 + g * m9 + b * m10 + m11;
    }
  }

  if (a.thresholdEnabled) {
    const cut = a.threshold;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const luma = data[i] * LUMA_R + data[i + 1] * LUMA_G + data[i + 2] * LUMA_B;
      const value = luma >= cut ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
  }

  if (a.sharpen > 0) {
    const amount = (a.sharpen / 100) * 1.6;
    const radius = Math.max(0.5, (a.sharpen / 100) * MAX_SHARPEN_RADIUS * scale);
    unsharpMask(data, width, height, amount, radius);
  }

  // Last, so the mosaic blocks stay perfectly flat. Running it earlier would
  // let the tone curve or sharpening reintroduce variation inside a cell and
  // leave a faint ghost of the content the block is meant to hide.
  if (a.pixelate > 0) {
    pixelate(data, width, height, a.pixelate * scale);
  }
}

/**
 * CSS `filter` string covering the adjustments a browser can do natively.
 *
 * Used only for the small live thumbnails in the layers panel, where an exact
 * match with the canvas pipeline matters less than staying cheap. The main
 * canvas always uses {@link applyAdjustments}.
 */
export function toCssFilter(a: Adjustments): string {
  const parts: string[] = [];
  if (a.exposure !== 0) parts.push(`brightness(${Math.pow(2, a.exposure).toFixed(3)})`);
  if (a.brightness !== 0) parts.push(`brightness(${(1 + a.brightness / 100).toFixed(3)})`);
  if (a.contrast !== 0) {
    const c = a.contrast >= 0 ? 1 + (a.contrast / 100) * 3 : 1 + a.contrast / 100;
    parts.push(`contrast(${c.toFixed(3)})`);
  }
  if (a.saturation !== 0) parts.push(`saturate(${(1 + a.saturation / 100).toFixed(3)})`);
  if (a.hue !== 0) parts.push(`hue-rotate(${a.hue}deg)`);
  if (a.grayscale > 0) parts.push(`grayscale(${(a.grayscale / 100).toFixed(3)})`);
  if (a.sepia > 0) parts.push(`sepia(${(a.sepia / 100).toFixed(3)})`);
  if (a.invert > 0) parts.push(`invert(${(a.invert / 100).toFixed(3)})`);
  if (a.blur > 0) parts.push(`blur(${((a.blur / 100) * MAX_BLUR_RADIUS) / 3}px)`);
  return parts.length ? parts.join(" ") : "none";
}

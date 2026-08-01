/**
 * Background removal.
 *
 * No machine-learning model is used: none can be fetched at runtime in a
 * privacy-first, offline-capable product, and shipping a multi-megabyte model
 * would dwarf the rest of the application. Instead this implements a genuine
 * classical matting pipeline that performs well on the cases people actually
 * bring to a background remover — product shots, headshots and graphics on a
 * plain or gently graded backdrop.
 *
 * The pipeline is:
 *
 *   1. sample the border to learn the background colour(s)
 *   2. score every pixel by its distance from those colours
 *   3. build a trimap: definite background, definite foreground, unknown
 *   4. flood-fill inward from the border so an interior region that merely
 *      *resembles* the background is not punched out
 *   5. resolve the unknown band into fractional alpha — this is what keeps
 *      hair and soft edges instead of producing a cut-out sticker
 *   6. despeckle, then feather
 *
 * Step 4 is what separates this from naive colour keying, and step 5 is what
 * separates it from a hard threshold.
 */

/** Perceptual weights; green dominates luminance, so differences there matter most. */
const CHANNEL_WEIGHT = { r: 0.3, g: 0.59, b: 0.11 } as const;

export interface RemovalSettings {
  /**
   * 0..100. How different a pixel may be from the background and still be
   * removed. Low values only take near-exact matches.
   */
  tolerance: number;
  /**
   * 0..100. Width of the uncertain band around the edge, as a proportion of
   * the tolerance. Wider bands recover more hair but risk semi-transparent
   * fringes on hard-edged subjects.
   */
  softness: number;
  /** 0..20 px. Shrinks (positive) or grows (negative) the mask edge. */
  edgeShift: number;
  /** 0..10 px of blur applied to the alpha channel only. */
  feather: number;
  /** Removes isolated specks smaller than this many pixels. */
  despeckle: number;
  /**
   * Restricts removal to background connected to the image border. Off lets
   * enclosed regions (a gap between an arm and a torso) be removed too.
   */
  edgeConnectedOnly: boolean;
  /**
   * Pulls residual background colour out of semi-transparent edge pixels.
   * Without it a subject cut from a green backdrop keeps a green rim.
   */
  decontaminate: boolean;
}

export const defaultRemovalSettings: RemovalSettings = {
  tolerance: 28,
  softness: 55,
  edgeShift: 0,
  feather: 1,
  despeckle: 24,
  edgeConnectedOnly: true,
  decontaminate: true,
};

export interface BackgroundSample {
  r: number;
  g: number;
  b: number;
  /** How much of the sampled border this colour accounted for, 0..1. */
  weight: number;
}

/** Which border a sampled pixel came from. Used to reject subject colours. */
const EDGE_TOP = 1;
const EDGE_RIGHT = 2;
const EDGE_BOTTOM = 4;
const EDGE_LEFT = 8;

function countEdges(mask: number): number {
  let count = 0;
  for (const edge of [EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM, EDGE_LEFT]) {
    if (mask & edge) count++;
  }
  return count;
}

/**
 * Learns the background colour(s) from the image border.
 *
 * Real backdrops are rarely one flat value — a studio sweep is lighter at the
 * top than the bottom — so several representative colours are kept and a pixel
 * is scored against its nearest. Colours are quantised into coarse buckets
 * first so that noise does not produce thousands of singleton "clusters".
 *
 * The subtlety is that the *subject* usually touches the border too: in almost
 * every portrait the shoulders run off the bottom edge. Naively taking the
 * most common border colours therefore learns the person's shirt as
 * "background" and cuts their body out.
 *
 * Two signals separate the two cases:
 *
 * - **Edge spread.** A backdrop appears on several sides; a subject that runs
 *   off the frame usually touches one. A cluster confined to a single edge is
 *   only accepted if it also dominates that edge.
 * - **Corners.** The four corners are the least likely place for a subject to
 *   be, so a colour present in a corner is weighted up.
 */
export function sampleBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  borderFraction = 0.04
): BackgroundSample[] {
  const band = Math.max(1, Math.round(Math.min(width, height) * borderFraction));
  const buckets = new Map<
    number,
    { r: number; g: number; b: number; count: number; edges: number; corner: number }
  >();
  let total = 0;

  // A generous corner box, so a slightly off-centre subject still leaves the
  // corners as reliable background.
  const cornerSize = Math.max(band, Math.round(Math.min(width, height) * 0.12));

  const add = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    if (data[index + 3] < 8) return;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];

    let edge = 0;
    if (y < band) edge |= EDGE_TOP;
    if (y >= height - band) edge |= EDGE_BOTTOM;
    if (x < band) edge |= EDGE_LEFT;
    if (x >= width - band) edge |= EDGE_RIGHT;

    const inCorner =
      (x < cornerSize || x >= width - cornerSize) &&
      (y < cornerSize || y >= height - cornerSize);

    // 5-bit-per-channel buckets: coarse enough to merge sensor noise, fine
    // enough to keep a gradient's distinct bands apart.
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
      bucket.edges |= edge;
      if (inCorner) bucket.corner++;
    } else {
      buckets.set(key, { r, g, b, count: 1, edges: edge, corner: inCorner ? 1 : 0 });
    }
    total++;
  };

  for (let y = 0; y < height; y++) {
    const isHorizontalBand = y < band || y >= height - band;
    if (isHorizontalBand) {
      for (let x = 0; x < width; x++) add(x, y);
    } else {
      for (let x = 0; x < band; x++) add(x, y);
      for (let x = Math.max(band, width - band); x < width; x++) add(x, y);
    }
  }

  if (!total) return [{ r: 255, g: 255, b: 255, weight: 1 }];

  const candidates = [...buckets.values()]
    .filter((bucket) => bucket.count / total > 0.01)
    .map((bucket) => {
      const share = bucket.count / total;
      const edges = countEdges(bucket.edges);
      const cornerShare = bucket.corner / bucket.count;

      // Score combines how much border it covers with how "surrounding" it is.
      // A colour on three or four edges is almost certainly the backdrop; one
      // confined to a single edge with no corner presence is almost certainly
      // the subject running out of frame.
      const spread = edges >= 3 ? 1 : edges === 2 ? 0.8 : 0.25;
      const cornerBonus = cornerShare > 0.15 ? 1 : 0.45;

      return { bucket, share, edges, cornerShare, score: share * spread * cornerBonus };
    })
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return [{ r: 255, g: 255, b: 255, weight: 1 }];

  // Anything scoring far below the strongest candidate is discarded rather
  // than kept as a weak "background" that would eat into the subject.
  const best = candidates[0].score;
  const accepted = candidates.filter(
    (candidate) =>
      candidate.score >= best * 0.12 &&
      // A single-edge colour with no corner presence is rejected outright: it
      // is the shape of a subject leaving the frame, not a backdrop.
      !(candidate.edges <= 1 && candidate.cornerShare < 0.05)
  );

  const chosen = (accepted.length ? accepted : [candidates[0]]).slice(0, 8);
  const totalShare = chosen.reduce((sum, candidate) => sum + candidate.share, 0) || 1;

  return chosen.map((candidate) => ({
    r: candidate.bucket.r / candidate.bucket.count,
    g: candidate.bucket.g / candidate.bucket.count,
    b: candidate.bucket.b / candidate.bucket.count,
    weight: candidate.share / totalShare,
  }));
}

/** Weighted Euclidean distance to the nearest sampled background colour. */
function backgroundDistance(
  r: number,
  g: number,
  b: number,
  samples: BackgroundSample[]
): number {
  let best = Infinity;
  for (const sample of samples) {
    const dr = (r - sample.r) * CHANNEL_WEIGHT.r;
    const dg = (g - sample.g) * CHANNEL_WEIGHT.g;
    const db = (b - sample.b) * CHANNEL_WEIGHT.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance < best) best = distance;
  }
  return best;
}

/** Trimap labels. */
const BACKGROUND = 0;
const UNKNOWN = 1;
const FOREGROUND = 2;

/**
 * Flood-fills background inward from the border.
 *
 * Uses an explicit stack rather than recursion: a full-HD image can produce a
 * fill hundreds of thousands of pixels deep, which would overflow the call
 * stack. Only pixels labelled background or unknown are traversed, so the fill
 * stops at the subject and cannot leak through it.
 */
function floodFillFromBorder(
  labels: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const reached = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let top = 0;

  const push = (index: number) => {
    if (reached[index] || labels[index] === FOREGROUND) return;
    reached[index] = 1;
    stack[top++] = index;
  };

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (top > 0) {
    const index = stack[--top];
    const x = index % width;
    const y = (index / width) | 0;

    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (y > 0) push(index - width);
    if (y < height - 1) push(index + width);
  }

  return reached;
}

/**
 * Removes connected alpha regions smaller than `minArea`.
 *
 * Sensor noise and JPEG artefacts leave single-pixel islands of "foreground"
 * floating in the removed area, and matching holes inside the subject. Both
 * are cleaned by the same pass, run once over the opaque set and once over the
 * transparent set.
 */
function despeckleAlpha(
  alpha: Float32Array,
  width: number,
  height: number,
  minArea: number,
  targetOpaque: boolean
): void {
  if (minArea <= 0) return;

  const visited = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  const region = new Int32Array(width * height);
  const isMember = (index: number) =>
    targetOpaque ? alpha[index] > 0.5 : alpha[index] <= 0.5;

  for (let start = 0; start < alpha.length; start++) {
    if (visited[start] || !isMember(start)) continue;

    let top = 0;
    let size = 0;
    stack[top++] = start;
    visited[start] = 1;

    while (top > 0) {
      const index = stack[--top];
      region[size++] = index;
      const x = index % width;
      const y = (index / width) | 0;

      const neighbours = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const neighbour of neighbours) {
        if (neighbour < 0 || visited[neighbour] || !isMember(neighbour)) continue;
        visited[neighbour] = 1;
        stack[top++] = neighbour;
      }
    }

    if (size < minArea) {
      const value = targetOpaque ? 0 : 1;
      for (let i = 0; i < size; i++) alpha[region[i]] = value;
    }
  }
}

/** Separable box blur over the alpha plane, used for feathering. */
function blurAlpha(alpha: Float32Array, width: number, height: number, radius: number): void {
  if (radius < 1) return;
  const scratch = new Float32Array(alpha.length);
  const window = radius * 2 + 1;

  for (let y = 0; y < height; y++) {
    let sum = 0;
    const row = y * width;
    for (let i = -radius; i <= radius; i++) {
      sum += alpha[row + Math.min(width - 1, Math.max(0, i))];
    }
    for (let x = 0; x < width; x++) {
      scratch[row + x] = sum / window;
      const out = row + Math.min(width - 1, Math.max(0, x - radius));
      const into = row + Math.min(width - 1, Math.max(0, x + radius + 1));
      sum += alpha[into] - alpha[out];
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let i = -radius; i <= radius; i++) {
      sum += scratch[Math.min(height - 1, Math.max(0, i)) * width + x];
    }
    for (let y = 0; y < height; y++) {
      alpha[y * width + x] = sum / window;
      const out = Math.min(height - 1, Math.max(0, y - radius)) * width + x;
      const into = Math.min(height - 1, Math.max(0, y + radius + 1)) * width + x;
      sum += scratch[into] - scratch[out];
    }
  }
}

/**
 * Erodes or dilates the mask by shifting the alpha threshold through a blur.
 *
 * Cheaper than a true morphological pass and, because the alpha is already
 * fractional, it produces a smoother result on soft edges.
 */
function shiftEdge(alpha: Float32Array, width: number, height: number, pixels: number): void {
  if (!pixels) return;
  const radius = Math.min(20, Math.abs(Math.round(pixels)));
  if (radius < 1) return;

  const reference = new Float32Array(alpha);
  blurAlpha(reference, width, height, radius);

  // Re-threshold against the blurred copy: comparing to a value above 0.5
  // pulls the edge inward, below 0.5 pushes it outward.
  const cut = pixels > 0 ? 0.62 : 0.38;
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] <= 0 || alpha[i] >= 1) {
      // Only move fully decided pixels; the soft band is left to the matte.
      alpha[i] = reference[i] >= cut ? 1 : 0;
    }
  }
}

export interface RemovalResult {
  /** Alpha plane, 0..1, one entry per pixel. */
  alpha: Float32Array;
  /** Background colours the sampler found, for the UI to display. */
  samples: BackgroundSample[];
  /** Proportion of the image judged to be background, 0..1. */
  removedFraction: number;
}

/**
 * Computes the alpha matte for an image.
 *
 * Returns the matte rather than applying it so the caller can preview,
 * composite over a replacement background, or export a transparent PNG from
 * one computation.
 */
export function computeRemovalMatte(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  settings: RemovalSettings,
  presampled?: BackgroundSample[]
): RemovalResult {
  const pixels = width * height;
  const samples = presampled?.length ? presampled : sampleBackground(data, width, height);

  // Tolerance is expressed on a 0..100 UI scale; map it onto the weighted
  // distance space, whose useful range runs to roughly 100.
  const near = (settings.tolerance / 100) * 60;
  const band = Math.max(1, near * (settings.softness / 100));
  const far = near + band;

  const labels = new Uint8Array(pixels);
  const distances = new Float32Array(pixels);

  for (let i = 0; i < pixels; i++) {
    const offset = i * 4;
    // An already-transparent pixel stays transparent.
    if (data[offset + 3] < 8) {
      labels[i] = BACKGROUND;
      distances[i] = 0;
      continue;
    }
    const distance = backgroundDistance(
      data[offset],
      data[offset + 1],
      data[offset + 2],
      samples
    );
    distances[i] = distance;
    labels[i] = distance <= near ? BACKGROUND : distance >= far ? FOREGROUND : UNKNOWN;
  }

  const alpha = new Float32Array(pixels);

  if (settings.edgeConnectedOnly) {
    const reached = floodFillFromBorder(labels, width, height);
    for (let i = 0; i < pixels; i++) {
      if (!reached[i]) {
        // Not connected to the border, so it is inside the subject.
        alpha[i] = 1;
        continue;
      }
      alpha[i] =
        labels[i] === BACKGROUND
          ? 0
          : labels[i] === FOREGROUND
            ? 1
            : // Fractional alpha across the uncertain band. This is the step
              // that preserves hair: strands that are a blend of subject and
              // backdrop become genuinely semi-transparent rather than being
              // rounded to one side.
              Math.min(1, Math.max(0, (distances[i] - near) / band));
    }
  } else {
    for (let i = 0; i < pixels; i++) {
      alpha[i] =
        labels[i] === BACKGROUND
          ? 0
          : labels[i] === FOREGROUND
            ? 1
            : Math.min(1, Math.max(0, (distances[i] - near) / band));
    }
  }

  if (settings.despeckle > 0) {
    despeckleAlpha(alpha, width, height, settings.despeckle, true);
    despeckleAlpha(alpha, width, height, settings.despeckle, false);
  }

  shiftEdge(alpha, width, height, settings.edgeShift);

  if (settings.feather > 0) {
    blurAlpha(alpha, width, height, Math.round(settings.feather));
  }

  let removed = 0;
  for (let i = 0; i < pixels; i++) removed += 1 - alpha[i];

  return { alpha, samples, removedFraction: removed / pixels };
}

/**
 * Applies a matte to RGBA pixels in place.
 *
 * With `decontaminate`, semi-transparent pixels have the background colour
 * subtracted out. A hair strand that is 40% subject over a green screen is
 * recorded as 40% of the subject's *own* colour, not 40% of the blended
 * green-tinted value — which is what stops the classic coloured fringe.
 */
export function applyMatte(
  data: Uint8ClampedArray,
  alpha: Float32Array,
  samples: BackgroundSample[],
  decontaminate: boolean
): void {
  const background = samples[0] ?? { r: 255, g: 255, b: 255, weight: 1 };

  for (let i = 0; i < alpha.length; i++) {
    const offset = i * 4;
    const a = alpha[i];

    if (a <= 0) {
      data[offset + 3] = 0;
      continue;
    }

    if (decontaminate && a < 0.98) {
      // observed = a * true + (1 - a) * background  ⇒  solve for true.
      const inverse = 1 / Math.max(0.08, a);
      data[offset] = (data[offset] - (1 - a) * background.r) * inverse;
      data[offset + 1] = (data[offset + 1] - (1 - a) * background.g) * inverse;
      data[offset + 2] = (data[offset + 2] - (1 - a) * background.b) * inverse;
    }

    data[offset + 3] = Math.round(a * 255 * (data[offset + 3] / 255));
  }
}

/* -------------------------------------------------------------------------- */
/* Brush refinement                                                           */
/* -------------------------------------------------------------------------- */

export type BrushMode = "restore" | "erase";

/**
 * Paints a circular brush stroke into a matte.
 *
 * Automatic segmentation will always miss something, so manual correction is
 * not a nicety — it is what makes the tool usable on a real photo. The brush
 * has a soft profile so corrections blend rather than leaving a hard disc.
 */
export function paintMatte(
  alpha: Float32Array,
  width: number,
  height: number,
  centreX: number,
  centreY: number,
  radius: number,
  mode: BrushMode,
  hardness = 0.6,
  strength = 1
): void {
  const target = mode === "restore" ? 1 : 0;
  const minX = Math.max(0, Math.floor(centreX - radius));
  const maxX = Math.min(width - 1, Math.ceil(centreX + radius));
  const minY = Math.max(0, Math.floor(centreY - radius));
  const maxY = Math.min(height - 1, Math.ceil(centreY + radius));
  const solid = radius * Math.min(0.99, hardness);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const distance = Math.hypot(x - centreX, y - centreY);
      if (distance > radius) continue;

      // Full strength inside the hard core, easing to zero at the rim.
      const falloff =
        distance <= solid ? 1 : 1 - (distance - solid) / Math.max(1e-6, radius - solid);
      const weight = Math.min(1, Math.max(0, falloff)) * strength;
      if (weight <= 0) continue;

      const index = y * width + x;
      alpha[index] = alpha[index] * (1 - weight) + target * weight;
    }
  }
}

/** Renders a matte as a visible mask, for the "show mask" preview. */
export function matteToPreview(
  alpha: Float32Array,
  width: number,
  height: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < alpha.length; i++) {
    const value = Math.round(alpha[i] * 255);
    out[i * 4] = value;
    out[i * 4 + 1] = value;
    out[i * 4 + 2] = value;
    out[i * 4 + 3] = 255;
  }
  return out;
}

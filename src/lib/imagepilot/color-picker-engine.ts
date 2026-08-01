export interface ColorSample {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
}

export interface EyedropperResult {
  pixel: ColorSample;
  average3x3: ColorSample;
  average5x5: ColorSample;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN: h = ((gN - bN) / d + (gN < bN ? 6 : 0)) * 60; break;
      case gN: h = ((bN - rN) / d + 2) * 60; break;
      case bN: h = ((rN - gN) / d + 4) * 60; break;
    }
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function sampleColor(imageData: ImageData, x: number, y: number, size: 1 | 3 | 5 = 1): ColorSample {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const half = Math.floor(size / 2);
  let r = 0, g = 0, b = 0, count = 0;
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const px = cx + dx, py = cy + dy;
      if (px < 0 || px >= imageData.width || py < 0 || py >= imageData.height) continue;
      const idx = (py * imageData.width + px) * 4;
      r += imageData.data[idx];
      g += imageData.data[idx + 1];
      b += imageData.data[idx + 2];
      count++;
    }
  }
  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);
  return {
    hex: rgbToHex(r, g, b),
    rgb: { r, g, b },
    hsl: rgbToHsl(r, g, b)
  };
}

export function eyedropperOnCanvas(canvas: HTMLCanvasElement, x: number, y: number): EyedropperResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  const imageData = ctx.getImageData(x, y, 1, 1);
  const avg3 = sampleColor(ctx.getImageData(Math.max(0, x - 1), Math.max(0, y - 1), 3, 3), 1, 1, 3);
  const avg5 = sampleColor(ctx.getImageData(Math.max(0, x - 2), Math.max(0, y - 2), 5, 5), 2, 2, 5);
  const pixel = sampleColor(imageData, 0, 0, 1);
  return { pixel, average3x3: avg3, average5x5: avg5 };
}

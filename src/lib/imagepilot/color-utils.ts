export function generatePalette(imageData: ImageData, count = 5): string[] {
  const colors: Record<string, number> = {};
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${r},${g},${b}`;
    colors[key] = (colors[key] || 0) + 1;
  }
  const sorted = Object.entries(colors).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, count).map(([key]) => `rgb(${key})`);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}

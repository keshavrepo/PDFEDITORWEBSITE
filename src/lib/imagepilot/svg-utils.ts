export function optimizeSvg(svgString: string): string {
  return svgString
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

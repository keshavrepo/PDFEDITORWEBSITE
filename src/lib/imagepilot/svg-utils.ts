export interface SvgOptimizationResult {
  originalBytes: number;
  optimizedBytes: number;
  deltaBytes: number;
  optimizedString: string;
}

export function optimizeSvg(svgString: string): SvgOptimizationResult {
  const originalBytes = new Blob([svgString]).size;
  // Strip XML comments
  let cleaned = svgString.replace(/<!--.*?-->/gs, '');
  // Strip metadata, editor namespaces
  cleaned = cleaned.replace(/xmlns:[a-z]+="[^"]+"/g, '');
  cleaned = cleaned.replace(/<metadata>.*?<\/metadata>/gis, '');
  // Collapse whitespace between tags
  cleaned = cleaned.replace(/>\s+</g, '><');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  // Round numeric precision in path data (simplified)
  cleaned = cleaned.replace(/(\d+\.\d{4,})/g, (m) => parseFloat(m).toFixed(2));
  // Drop default fill/stroke when black
  cleaned = cleaned.replace(/fill="black"/g, '');
  cleaned = cleaned.trim();
  const optimizedBytes = new Blob([cleaned]).size;
  return {
    originalBytes,
    optimizedBytes,
    deltaBytes: originalBytes - optimizedBytes,
    optimizedString: cleaned,
  };
}

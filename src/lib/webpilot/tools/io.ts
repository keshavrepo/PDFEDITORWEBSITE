/**
 * Browser-only I/O helpers used by every WebPilot tool.
 *
 * Pure wrappers around `navigator.clipboard.writeText`,
 * `URL.createObjectURL` and a hidden anchor so the surfaces stay
 * declarative. No-op in non-browser environments so server-side
 * rendering never crashes.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadTextFile(
  text: string,
  filename: string,
  mimeType = "text/plain"
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/** Read a File as a data URL. Browser-only. */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Read a File as a raw byte array. Browser-only. */
export function readFileAsBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(new Uint8Array(result));
      } else {
        reject(new Error("Unexpected reader result"));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Best-effort detection of an image's intrinsic dimensions. Returns
 * `null` outside the browser or when the asset is not a decodable
 * image (SVG, font, video, etc.).
 */
export function readImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number } | null> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

/** Format a byte count as a human-readable string. */
export function formatBytes(bytes: number): string {
  const value = Math.max(0, Math.floor(bytes));
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024)
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

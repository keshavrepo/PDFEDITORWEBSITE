/**
 * Browser download helper.
 *
 * One implementation shared by every product. This previously existed twice —
 * once in `pdf-utils` (wrapping the `file-saver` package) and once in
 * ImagePilot's raster module — which meant importing a download helper could
 * drag in an entire PDF engine.
 *
 * Deliberately dependency-free so it costs nothing to import from anywhere.
 */

/**
 * Triggers a download of a blob.
 *
 * Uses a plain anchor with the `download` attribute, which every current
 * browser supports. The object URL is revoked on a delay because revoking it
 * synchronously cancels the transfer in some browsers.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

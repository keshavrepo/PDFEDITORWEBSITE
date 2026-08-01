/**
 * Client-side helper for reporting completed work to the platform.
 *
 * Products call this after finishing an operation so the file manager,
 * activity timeline and dashboard statistics stay in sync. Only the file name
 * and size are sent — PDFPilot and OfficePilot both process documents in the
 * browser, so no document content ever leaves the device.
 *
 * Reporting is best-effort: a signed-out user or a failed request must never
 * interfere with the download the user actually asked for.
 */

export interface ActivityReport {
  /**
   * Owning product. Defaults to `pdfpilot` for backwards compatibility with
   * existing PDFPilot callers; new products should pass their own id.
   */
  productId?: string;
  toolName: string;
  status?: "completed" | "failed";
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  inputFileSize?: number;
  processingTime?: number;
  errorMessage?: string;
}

export async function recordActivity(report: ActivityReport): Promise<void> {
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Spread last so the caller's productId is honoured over the default.
      body: JSON.stringify({ status: "completed", productId: "pdfpilot", ...report }),
      // Allows the request to complete even if the page is navigating away.
      keepalive: true,
    });
  } catch {
    // Recording is never allowed to surface an error to the user.
  }
}

import { ImageResponse } from "next/og";

/**
 * Dynamic favicon.
 *
 * Renders the LaunchStack wordmark on a solid foreground tile. The
 * geometry is fixed so the icon is consistent in the browser tab,
 * the OS task switcher and PWA installs. ImageResponse handles the
 * runtime edge cache and the Content-Type.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          borderRadius: 8,
        }}
      >
        L
      </div>
    ),
    { ...size }
  );
}

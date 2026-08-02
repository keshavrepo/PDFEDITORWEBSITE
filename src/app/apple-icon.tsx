import { ImageResponse } from "next/og";

/**
 * Dynamic Apple touch icon.
 *
 * 180x180 so it covers every iOS home-screen target. Same wordmark
 * as the favicon; iOS rounds the corners itself.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        L
      </div>
    ),
    { ...size }
  );
}

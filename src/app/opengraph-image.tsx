import { ImageResponse } from "next/og";
import { platform } from "@/lib/products";

/**
 * Default OpenGraph / Twitter card image.
 *
 * 1200x630 is the canonical OG card size; Twitter's
 * `summary_large_image` reads the same dimensions. The image is
 * dark with the platform wordmark and tagline so it reads well
 * when shared on any background.
 */
export const alt = `${platform.name} — ${platform.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #1f2937 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              color: "#0a0a0a",
              borderRadius: 12,
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            L
          </div>
          <span>{platform.name}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              maxWidth: 1000,
            }}
          >
            {platform.tagline}
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.7)",
              maxWidth: 900,
              lineHeight: 1.3,
            }}
          >
            PDFPilot · ImagePilot · AudioPilot · OfficePilot · DevPilot ·
            SocialPilot · FinancePilot · WebPilot
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

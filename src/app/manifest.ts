import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/seo";

/**
 * Web App Manifest.
 *
 * PWA metadata for browsers that can install LaunchStack as an
 * app. Theme colors match the platform palette declared in
 * globals.css. The icons resolve to the dynamic /icon route so we
 * don't have to ship a static icon asset.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LaunchStack",
    short_name: "LaunchStack",
    description:
      "LaunchStack is a growing suite of focused, privacy-first productivity products. PDFPilot, ImagePilot, AudioPilot, OfficePilot, DevPilot, SocialPilot, FinancePilot and WebPilot are available today.",
    start_url: appOrigin(),
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "any",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

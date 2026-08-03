"use client";

/**
 * Lazily loaded workspace panels.
 *
 * Every ImagePilot workspace runs the same editor shell, but each one only
 * ever renders its own inspector. Importing all of them statically meant a
 * user opening the Compressor also downloaded the watermark, passport,
 * background, blur, metadata and convert panels — and, transitively, the
 * engines behind them.
 *
 * Splitting them here keeps the shell small and lets a workspace pay only for
 * what it shows. `ssr: false` is correct for all of them: they are pure
 * control surfaces over browser-only state (canvas rasters, decoded bytes),
 * so there is nothing meaningful to render on the server.
 *
 * The fallback deliberately mirrors the panel's own padding so the inspector
 * does not jump when the real panel arrives.
 */

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton shown while a panel chunk is in flight. */
function PanelSkeleton() {
  return (
    <div className="space-y-3 p-3" aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

/*
 * Each call passes its options inline: `next/dynamic` is compiled statically,
 * so the options must be an object literal rather than a shared constant.
 */

export const WatermarkPanel = dynamic(
  () => import("./watermark-panel").then((m) => m.WatermarkPanel),
  { loading: PanelSkeleton, ssr: false }
);

export const PassportPanel = dynamic(
  () => import("./passport-panel").then((m) => m.PassportPanel),
  { loading: PanelSkeleton, ssr: false }
);

export const CompressPanel = dynamic(
  () => import("./compress-panel").then((m) => m.CompressPanel),
  { loading: PanelSkeleton, ssr: false }
);

export const BackgroundPanel = dynamic(
  () => import("./background-panel").then((m) => m.BackgroundPanel),
  { loading: PanelSkeleton, ssr: false }
);

export const BlurPanel = dynamic(
  () => import("./blur-panel").then((m) => m.BlurPanel),
  { loading: PanelSkeleton, ssr: false }
);

export const MetadataPanel = dynamic(
  () => import("./metadata-panel").then((m) => m.MetadataPanel),
  { loading: PanelSkeleton, ssr: false }
);

export const ConvertPanel = dynamic(
  () => import("./convert-panel").then((m) => m.ConvertPanel),
  { loading: PanelSkeleton, ssr: false }
);

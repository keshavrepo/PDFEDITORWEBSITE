/**
 * SocialPilot platform catalogue.
 *
 * The catalogue is shared by the Platform Profiles surface, the
 * Publishing Queue (the per-item platform picker) and the future
 * scheduler. Adding a new platform means appending one entry here;
 * the chips, the brand colours and the per-platform defaults all
 * follow.
 */

import type { SocialPlatformKey, SocialPlatformMeta } from "./types";

export const PLATFORMS: SocialPlatformMeta[] = [
  { key: "facebook", name: "Facebook", color: "bg-blue-600 text-white", initials: "Fb" },
  { key: "instagram", name: "Instagram", color: "bg-pink-500 text-white", initials: "Ig" },
  { key: "x", name: "X", color: "bg-black text-white", initials: "X" },
  { key: "linkedin", name: "LinkedIn", color: "bg-blue-700 text-white", initials: "Li" },
  { key: "youtube", name: "YouTube", color: "bg-red-600 text-white", initials: "Yt" },
  { key: "tiktok", name: "TikTok", color: "bg-black text-white", initials: "Tt" },
  { key: "threads", name: "Threads", color: "bg-zinc-900 text-white", initials: "Th" },
  { key: "pinterest", name: "Pinterest", color: "bg-red-500 text-white", initials: "Pn" },
];

export function getPlatformMeta(key: SocialPlatformKey | ""): SocialPlatformMeta | null {
  if (!key) return null;
  return PLATFORMS.find((platform) => platform.key === key) ?? null;
}

export function platformLabel(key: SocialPlatformKey | ""): string {
  return getPlatformMeta(key)?.name ?? "No platform";
}

export function platformColor(key: SocialPlatformKey | ""): string {
  return getPlatformMeta(key)?.color ?? "bg-muted text-foreground";
}

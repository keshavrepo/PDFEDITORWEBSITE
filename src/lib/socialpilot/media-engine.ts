/**
 * SocialPilot media engine.
 *
 * The engine is a thin layer over the IndexedDB-backed storage that
 * adds the business rules every product needs: kind detection,
 * initial title, the asset binary + object URL, and the recent-media
 * mirror in the server database.
 *
 * Server-side code that needs to read recent media uses the
 * `listRecentMedia` helper in `recent.ts`; this module is the
 * client-side counterpart.
 */

import {
  deleteAssetStorage,
  generateAssetId,
  getAssetStorage,
  listAssetsStorage,
  saveAssetStorage,
} from "./client-storage";
import type {
  SocialMediaAsset,
  SocialMediaAssetSummary,
  SocialMediaKind,
} from "./types";

/** Detects the media kind from a mime type. */
export function detectMediaKind(mimeType: string | null | undefined): SocialMediaKind {
  if (!mimeType) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "image";
}

/** Derives a default title from a filename. */
function defaultTitle(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return filename;
  return filename.slice(0, dot);
}

/**
 * Creates a media asset from a browser File. The asset stores the
 * binary, mime type, size and an object URL for in-browser preview.
 */
export async function createMediaAsset(
  file: File,
  options: { projectId?: string | null; title?: string; tags?: string[] } = {}
): Promise<SocialMediaAsset> {
  const now = new Date().toISOString();
  const kind = detectMediaKind(file.type);
  const id = generateAssetId();
  const objectUrl =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(file)
      : null;
  const asset: SocialMediaAsset = {
    id,
    kind,
    title: options.title?.trim() || defaultTitle(file.name) || "Untitled asset",
    filename: file.name,
    mimeType: file.type || null,
    size: file.size,
    objectUrl,
    projectId: options.projectId ?? null,
    tags: options.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
  const result = await saveAssetStorage(asset);
  if (!result.ok) return asset;
  await recordRecentMedia(result.asset);
  return result.asset;
}

/** Lists media assets, newest first. */
export async function listMediaAssets(
  options: {
    projectId?: string | null;
    kind?: SocialMediaKind;
    search?: string;
    limit?: number;
  } = {}
): Promise<SocialMediaAssetSummary[]> {
  const { assets } = await listAssetsStorage(options);
  return assets;
}

/** Reads a media asset by id. */
export async function getMediaAsset(id: string): Promise<SocialMediaAsset | null> {
  return getAssetStorage(id);
}

/** Deletes a media asset. */
export async function deleteMediaAsset(id: string): Promise<boolean> {
  const ok = await deleteAssetStorage(id);
  if (ok) {
    try {
      await fetch(`/api/socialpilot/media/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch {
      // Best-effort: the dashboard mirror may be slightly stale.
    }
  }
  return ok;
}

/** Best-effort mirror of a media asset into the server-side index. */
async function recordRecentMedia(asset: SocialMediaAsset): Promise<void> {
  try {
    await fetch("/api/socialpilot/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: asset.id,
        projectId: asset.projectId,
        kind: asset.kind,
        title: asset.title,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.size,
        tags: asset.tags,
        updatedAt: asset.updatedAt,
        createdAt: asset.createdAt,
      }),
    });
  } catch {
    // The local copy is the source of truth; the mirror is a hint.
  }
}

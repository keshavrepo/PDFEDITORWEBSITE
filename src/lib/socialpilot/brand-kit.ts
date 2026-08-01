/**
 * SocialPilot server-side brand-kit helper.
 *
 * The brand kit is small (logos, colours, fonts, default social
 * profiles) and is read on every workspace load, so it lives entirely
 * in the database. The browser keeps an in-memory copy and mirrors
 * changes back to the server through the brand-kit API.
 *
 * The row is one per user; the body is the four arrays. The shape is
 * loosely typed because the user is free to add any number of logos,
 * colours, fonts and profiles.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { socialBrandKits } from "@/db/schema";
import type {
  SocialBrandColor,
  SocialBrandFont,
  SocialBrandKit,
  SocialBrandLogo,
  SocialBrandProfile,
} from "./types";

/** The default brand kit returned when the user has none. */
export const defaultBrandKit: SocialBrandKit = {
  id: "default",
  name: "Default brand kit",
  logos: [],
  colors: [],
  fonts: [],
  profiles: [],
};

function isLogoArray(value: unknown): value is SocialBrandLogo[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as SocialBrandLogo).id === "string" &&
        typeof (entry as SocialBrandLogo).name === "string" &&
        typeof (entry as SocialBrandLogo).dataUrl === "string"
    )
  );
}

function isColorArray(value: unknown): value is SocialBrandColor[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as SocialBrandColor).id === "string" &&
        typeof (entry as SocialBrandColor).name === "string" &&
        typeof (entry as SocialBrandColor).value === "string"
    )
  );
}

function isFontArray(value: unknown): value is SocialBrandFont[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as SocialBrandFont).id === "string" &&
        typeof (entry as SocialBrandFont).name === "string" &&
        typeof (entry as SocialBrandFont).family === "string" &&
        typeof (entry as SocialBrandFont).weight === "number"
    )
  );
}

function isProfileArray(value: unknown): value is SocialBrandProfile[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as SocialBrandProfile).id === "string" &&
        typeof (entry as SocialBrandProfile).platform === "string" &&
        typeof (entry as SocialBrandProfile).handle === "string" &&
        typeof (entry as SocialBrandProfile).url === "string"
    )
  );
}

/** Coerces whatever is stored into a complete, valid brand kit. */
export function parseBrandKit(row: {
  name: string;
  logos: unknown;
  colors: unknown;
  fonts: unknown;
  profiles: unknown;
}): SocialBrandKit {
  return {
    id: "default",
    name: row.name || defaultBrandKit.name,
    logos: isLogoArray(row.logos) ? row.logos : [],
    colors: isColorArray(row.colors) ? row.colors : [],
    fonts: isFontArray(row.fonts) ? row.fonts : [],
    profiles: isProfileArray(row.profiles) ? row.profiles : [],
  };
}

/** Returns the user's brand kit, creating the default row if it does not exist. */
export async function getBrandKit(userId: string): Promise<SocialBrandKit> {
  const rows = await db
    .select()
    .from(socialBrandKits)
    .where(eq(socialBrandKits.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { ...defaultBrandKit };
  }
  return parseBrandKit(row);
}

/** Upserts the user's brand kit. */
export async function saveBrandKit(
  userId: string,
  kit: SocialBrandKit
): Promise<SocialBrandKit> {
  const next: SocialBrandKit = {
    id: "default",
    name: kit.name?.trim() || defaultBrandKit.name,
    logos: Array.isArray(kit.logos) ? kit.logos : [],
    colors: Array.isArray(kit.colors) ? kit.colors : [],
    fonts: Array.isArray(kit.fonts) ? kit.fonts : [],
    profiles: Array.isArray(kit.profiles) ? kit.profiles : [],
  };

  await db
    .insert(socialBrandKits)
    .values({
      userId,
      name: next.name,
      logos: next.logos,
      colors: next.colors,
      fonts: next.fonts,
      profiles: next.profiles,
      updatedAt: new Date(),
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: socialBrandKits.userId,
      set: {
        name: next.name,
        logos: next.logos,
        colors: next.colors,
        fonts: next.fonts,
        profiles: next.profiles,
        updatedAt: new Date(),
      },
    });

  return next;
}

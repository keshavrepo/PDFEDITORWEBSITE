/**
 * Server-side helpers for the SocialPilot Batch 3 user state.
 *
 * One row per user, per concern: brand profiles, platform profiles,
 * media collections, and the small "active brand / active profile"
 * state. The bodies are stored as JSON columns; the workspace
 * keeps an in-memory copy and mirrors changes through the API.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  socialBrandProfiles,
  socialMediaCollections,
  socialPlatformProfiles,
  socialUserState,
} from "@/db/schema";
import type {
  SocialBrand,
  SocialMediaCollection,
  SocialPlatformProfile,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Brand profiles                                                             */
/* -------------------------------------------------------------------------- */

function isBrand(value: unknown): value is SocialBrand {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return false;
  return Array.isArray(record.logos) && Array.isArray(record.colors);
}

export async function getBrandProfiles(userId: string): Promise<SocialBrand[]> {
  const rows = await db
    .select()
    .from(socialBrandProfiles)
    .where(eq(socialBrandProfiles.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return [];
  const raw = row.brands;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isBrand);
}

export async function saveBrandProfiles(
  userId: string,
  brands: SocialBrand[]
): Promise<SocialBrand[]> {
  await db
    .insert(socialBrandProfiles)
    .values({
      userId,
      brands,
      updatedAt: new Date(),
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: socialBrandProfiles.userId,
      set: { brands, updatedAt: new Date() },
    });
  return brands;
}

/* -------------------------------------------------------------------------- */
/* Platform profiles                                                          */
/* -------------------------------------------------------------------------- */

function isProfile(value: unknown): value is SocialPlatformProfile {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.platform === "string"
  );
}

export async function getPlatformProfiles(
  userId: string
): Promise<SocialPlatformProfile[]> {
  const rows = await db
    .select()
    .from(socialPlatformProfiles)
    .where(eq(socialPlatformProfiles.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return [];
  const raw = row.profiles;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isProfile);
}

export async function savePlatformProfiles(
  userId: string,
  profiles: SocialPlatformProfile[]
): Promise<SocialPlatformProfile[]> {
  await db
    .insert(socialPlatformProfiles)
    .values({
      userId,
      profiles,
      updatedAt: new Date(),
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: socialPlatformProfiles.userId,
      set: { profiles, updatedAt: new Date() },
    });
  return profiles;
}

/* -------------------------------------------------------------------------- */
/* Media collections                                                          */
/* -------------------------------------------------------------------------- */

function isCollection(value: unknown): value is SocialMediaCollection {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    Array.isArray(record.assetIds)
  );
}

export async function getMediaCollections(
  userId: string
): Promise<SocialMediaCollection[]> {
  const rows = await db
    .select()
    .from(socialMediaCollections)
    .where(eq(socialMediaCollections.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return [];
  const raw = row.collections;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isCollection);
}

export async function saveMediaCollections(
  userId: string,
  collections: SocialMediaCollection[]
): Promise<SocialMediaCollection[]> {
  await db
    .insert(socialMediaCollections)
    .values({
      userId,
      collections,
      updatedAt: new Date(),
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: socialMediaCollections.userId,
      set: { collections, updatedAt: new Date() },
    });
  return collections;
}

/* -------------------------------------------------------------------------- */
/* User state                                                                 */
/* -------------------------------------------------------------------------- */

export interface SocialUserState {
  activeBrandId: string;
  activeProfileId: string;
}

export async function getUserState(userId: string): Promise<SocialUserState> {
  const rows = await db
    .select()
    .from(socialUserState)
    .where(eq(socialUserState.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return { activeBrandId: "", activeProfileId: "" };
  return {
    activeBrandId: row.activeBrandId ?? "",
    activeProfileId: row.activeProfileId ?? "",
  };
}

export async function saveUserState(
  userId: string,
  state: SocialUserState
): Promise<SocialUserState> {
  await db
    .insert(socialUserState)
    .values({
      userId,
      activeBrandId: state.activeBrandId,
      activeProfileId: state.activeProfileId,
      updatedAt: new Date(),
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: socialUserState.userId,
      set: {
        activeBrandId: state.activeBrandId,
        activeProfileId: state.activeProfileId,
        updatedAt: new Date(),
      },
    });
  return state;
}

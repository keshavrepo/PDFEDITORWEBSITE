/**
 * AudioPilot session engine.
 *
 * The engine is a thin layer over the IndexedDB-backed storage that
 * adds the business rules every product needs: id generation,
 * initial title, the version counter, the session engine and the
 * recent-sessions mirror in the server database.
 *
 * Server-side code that needs to read recent sessions uses the
 * `listRecentSessions` helper in `recent.ts`; this module is the
 * client-side counterpart that the workspace shell calls when a
 * user creates, opens, saves or closes a session.
 *
 * Mirrors the WebPilot / DevPilot / SocialPilot / FinancePilot
 * engine shape.
 */

import {
  autosaveSessionStorage,
  createSessionStorage,
  deleteSessionStorage,
  duplicateSessionStorage,
  generateSessionId,
  getSessionStorage,
  listSessionsStorage,
  renameSessionStorage,
  saveSessionStorage,
  toggleFavoriteSessionStorage,
} from "./client-storage";
import { getSession } from "./sessions";
import { createBlankBody, loadTemplateBody } from "./templates";
import type {
  AudioSession,
  AudioSessionCategory,
  AudioSessionKind,
  AudioSessionSummary,
  AudioTemplate,
} from "./types";

/** Title used when the user has not typed one yet. */
function defaultTitle(
  kind: AudioSessionKind,
  category: AudioSessionCategory
): string {
  const session = getSession(kind);
  if (session) {
    if (category === "blank") return `Untitled ${session.name}`;
    return `Untitled ${sessionCategoryTitle(category)} ${session.name}`;
  }
  if (category === "blank") return "Untitled session";
  return `Untitled ${sessionCategoryTitle(category)}`;
}

/** Title-cased category, used in default session titles. */
function sessionCategoryTitle(category: AudioSessionCategory): string {
  const text = category.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Creates a fresh session. The optional `template` argument loads
 * a starter body and category; without it, the session is blank.
 */
export async function createAudioSession(
  kind: AudioSessionKind,
  options: {
    template?: AudioTemplate;
    title?: string;
    initialBody?: unknown;
  } = {}
): Promise<AudioSession> {
  const template = options.template;
  const category = template?.category ?? "blank";
  const body =
    options.initialBody !== undefined
      ? options.initialBody
      : template
        ? loadTemplateBody(template)
        : createBlankBody(kind);
  const now = new Date().toISOString();
  const id = generateSessionId(kind);
  const session: AudioSession = {
    meta: {
      id,
      kind,
      title: options.title?.trim() || defaultTitle(kind, category),
      category,
      createdAt: now,
      updatedAt: now,
      autosavedAt: null,
      version: 1,
      size: 0,
      tags: [],
      isFavorite: false,
    },
    body,
  };
  const result = await createSessionStorage(session);
  if (!result.ok || !result.session) {
    return {
      ...session,
      meta: { ...session.meta, size: JSON.stringify(session).length },
    };
  }
  return result.session;
}

/** Opens a session by id. Returns `null` if it does not exist locally. */
export async function openAudioSession(
  id: string
): Promise<AudioSession | null> {
  return getSessionStorage(id);
}

/** Saves a session, bumping the version and the timestamps. */
export async function saveAudioSession(
  session: AudioSession
): Promise<AudioSession> {
  const result = await saveSessionStorage(session);
  const saved = result.ok && result.session ? result.session : session;
  await recordRecentSession(saved);
  return saved;
}

/** Autosaves a session, skipping the write when the body is unchanged. */
export async function autosaveAudioSession(
  session: AudioSession
): Promise<AudioSession> {
  const result = await autosaveSessionStorage(session);
  const saved = result.ok && result.session ? result.session : session;
  await recordRecentSession(saved);
  return saved;
}

/** Renames a session. Returns the updated summary or `null`. */
export async function renameAudioSession(
  id: string,
  title: string
): Promise<AudioSessionSummary | null> {
  const summary = await renameSessionStorage(id, title);
  if (summary) {
    const existing = await getSessionStorage(id);
    if (existing) await recordRecentSession(existing);
  }
  return summary;
}

/** Toggles the favourite flag on a session. */
export async function toggleFavoriteAudioSession(
  id: string
): Promise<AudioSessionSummary | null> {
  const summary = await toggleFavoriteSessionStorage(id);
  if (summary) {
    const existing = await getSessionStorage(id);
    if (existing) await recordRecentSession(existing);
  }
  return summary;
}

/** Duplicates a session and returns the new session. */
export async function duplicateAudioSession(
  id: string
): Promise<AudioSession | null> {
  const copy = await duplicateSessionStorage(id);
  if (copy) await recordRecentSession(copy);
  return copy;
}

/** Soft-deletes a session. */
export async function deleteAudioSession(id: string): Promise<boolean> {
  const ok = await deleteSessionStorage(id);
  if (ok) {
    try {
      await fetch(`/api/audiopilot/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch {
      // Best-effort: the dashboard mirror may be slightly stale until
      // the next page load rebuilds it.
    }
  }
  return ok;
}

/** Lists recent session summaries, newest first. */
export async function listAudioSessions(
  options: {
    kind?: AudioSessionKind;
    limit?: number;
    favoritesOnly?: boolean;
  } = {}
): Promise<AudioSessionSummary[]> {
  const { summaries } = await listSessionsStorage(options);
  return summaries;
}

/**
 * Best-effort mirror of a session into the server-side recent
 * index. Failures here never surface to the user because the
 * session is already saved locally.
 */
async function recordRecentSession(session: AudioSession): Promise<void> {
  try {
    await fetch("/api/audiopilot/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: session.meta.id,
        kind: session.meta.kind,
        title: session.meta.title,
        category: session.meta.category,
        version: session.meta.version,
        size: session.meta.size,
        isFavorite: session.meta.isFavorite,
        updatedAt: session.meta.updatedAt,
      }),
    });
  } catch {
    // The local copy is the source of truth; the mirror is a hint.
  }
}

/**
 * OfficePilot document engine.
 *
 * The engine is a thin layer over the IndexedDB-backed storage that adds the
 * business rules every product needs: id generation, initial title, the
 * audit log, the version counter and the recent-documents mirror in the
 * server database.
 *
 * Server-side code that needs to read recent documents uses the
 * `getRecentDocuments` helper in `recent.ts`; this module is the
 * client-side counterpart that the workspace shell calls when a user
 * creates, opens, saves or closes a document.
 */

import { getEditor } from "./editors";
import { createBlankBody, loadTemplateBody } from "./templates";
import {
  autosaveDocument as storageAutosave,
  createDocument as storageCreate,
  deleteDocument as storageDelete,
  duplicateDocument as storageDuplicate,
  generateDocumentId,
  getDocument as storageGet,
  listDocuments as storageList,
  renameDocument as storageRename,
  saveDocument as storageSave,
} from "./client-storage";
import type {
  OfficeDocument,
  OfficeDocumentCategory,
  OfficeDocumentSummary,
  OfficeEditorKind,
  OfficeTemplate,
} from "./types";

/** Title used when the user has not typed one yet. */
function defaultTitle(kind: OfficeEditorKind, category: OfficeDocumentCategory): string {
  const editor = getEditor(kind);
  if (category === "blank") return `Untitled ${editor.name.replace(" Editor", "")}`;
  return `Untitled ${category.replace(/-/g, " ")}`;
}

/**
 * Creates a fresh document. The optional `template` argument loads a starter
 * body and category; without it, the document is blank.
 */
export async function createOfficeDocument(
  kind: OfficeEditorKind,
  options: { template?: OfficeTemplate; title?: string } = {}
): Promise<OfficeDocument> {
  const template = options.template;
  const category = template?.category ?? "blank";
  const body = template
    ? loadTemplateBody(template)
    : createBlankBody(kind);
  const now = new Date().toISOString();
  const id = generateDocumentId(kind);
  const document: OfficeDocument = {
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
    },
    body,
  };
  const result = await storageCreate(document);
  if (!result.ok) {
    // Storage failure should be rare in the browser; fall back to a
    // in-memory document so the editor still opens.
    return { ...document, meta: { ...document.meta, size: JSON.stringify(document).length } };
  }
  return result.document;
}

/** Opens a document by id. Returns `null` if it does not exist locally. */
export async function openOfficeDocument(
  id: string
): Promise<OfficeDocument | null> {
  return storageGet(id);
}

/**
 * Saves a document. The caller passes the full document; the engine bumps
 * the version and the timestamps, then writes through.
 */
export async function saveOfficeDocument(
  document: OfficeDocument
): Promise<OfficeDocument> {
  const result = await storageSave(document);
  if (!result.ok) return document;
  await recordRecentDocument(result.document);
  return result.document;
}

/** Autosaves a document, skipping the write when the body is unchanged. */
export async function autosaveOfficeDocument(
  document: OfficeDocument
): Promise<OfficeDocument> {
  const result = await storageAutosave(document);
  if (!result.ok) return document;
  await recordRecentDocument(result.document);
  return result.document;
}

/** Renames a document. Returns the updated summary or `null`. */
export async function renameOfficeDocument(
  id: string,
  title: string
): Promise<OfficeDocumentSummary | null> {
  const summary = await storageRename(id, title);
  if (summary) {
    const existing = await storageGet(id);
    if (existing) await recordRecentDocument(existing);
  }
  return summary;
}

/** Duplicates a document and returns the new document. */
export async function duplicateOfficeDocument(
  id: string
): Promise<OfficeDocument | null> {
  const copy = await storageDuplicate(id);
  if (copy) await recordRecentDocument(copy);
  return copy;
}

/** Soft-deletes a document. */
export async function deleteOfficeDocument(id: string): Promise<boolean> {
  const ok = await storageDelete(id);
  if (ok) {
    try {
      await fetch(`/api/office/documents/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch {
      // Best-effort: the dashboard mirror may be slightly stale until the
      // next page load rebuilds it.
    }
  }
  return ok;
}

/** Lists recent document summaries, newest first. */
export async function listOfficeDocuments(
  options: { kind?: OfficeEditorKind; limit?: number } = {}
): Promise<OfficeDocumentSummary[]> {
  const { summaries } = await storageList(options);
  return summaries;
}

/**
 * Best-effort mirror of a document into the server-side recent-documents
 * table. The dashboard, file manager and search use it; failures here never
 * surface to the user because the document is already saved locally.
 */
async function recordRecentDocument(document: OfficeDocument): Promise<void> {
  try {
    await fetch("/api/office/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: document.meta.id,
        kind: document.meta.kind,
        title: document.meta.title,
        category: document.meta.category,
        version: document.meta.version,
        size: document.meta.size,
        updatedAt: document.meta.updatedAt,
      }),
    });
  } catch {
    // The local copy is the source of truth; the mirror is a hint.
  }
}

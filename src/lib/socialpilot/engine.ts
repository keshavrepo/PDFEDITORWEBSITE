/**
 * SocialPilot project engine.
 *
 * The engine is a thin layer over the IndexedDB-backed storage that
 * adds the business rules every product needs: id generation, initial
 * title, the version counter, the project engine and the
 * recent-projects mirror in the server database.
 *
 * Server-side code that needs to read recent projects uses the
 * `listRecentProjects` helper in `recent.ts`; this module is the
 * client-side counterpart that the workspace shell calls when a user
 * creates, opens, saves or closes a project.
 */

import {
  autosaveProjectStorage,
  createProjectStorage,
  deleteProjectStorage,
  duplicateProjectStorage,
  generateProjectId,
  getProjectStorage,
  listProjectsStorage,
  renameProjectStorage,
  saveProjectStorage,
  toggleFavoriteProjectStorage,
} from "./client-storage";
import { getProject } from "./projects";
import { createBlankBody, loadTemplateBody } from "./templates";
import type {
  SocialProject,
  SocialProjectCategory,
  SocialProjectKind,
  SocialProjectSummary,
  SocialTemplate,
} from "./types";

/** Title used when the user has not typed one yet. */
function defaultTitle(
  kind: SocialProjectKind,
  category: SocialProjectCategory
): string {
  const project = getProject(kind);
  if (project) {
    if (category === "blank") return `Untitled ${project.name}`;
    return `Untitled ${projectCategoryTitle(category)} ${project.name}`;
  }
  if (category === "blank") return "Untitled project";
  return `Untitled ${projectCategoryTitle(category)}`;
}

/** Title-cased category, used in default project titles. */
function projectCategoryTitle(category: SocialProjectCategory): string {
  const text = category.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Creates a fresh project. The optional `template` argument loads a
 * starter body and category; without it, the project is blank.
 */
export async function createSocialProject(
  kind: SocialProjectKind,
  options: { template?: SocialTemplate; title?: string } = {}
): Promise<SocialProject> {
  const template = options.template;
  const category = template?.category ?? "blank";
  const body = template ? loadTemplateBody(template) : createBlankBody(kind);
  const now = new Date().toISOString();
  const id = generateProjectId(kind);
  const project: SocialProject = {
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
  const result = await createProjectStorage(project);
  if (!result.ok) {
    return {
      ...project,
      meta: { ...project.meta, size: JSON.stringify(project).length },
    };
  }
  return result.project;
}

/** Opens a project by id. Returns `null` if it does not exist locally. */
export async function openSocialProject(
  id: string
): Promise<SocialProject | null> {
  return getProjectStorage(id);
}

/** Saves a project, bumping the version and the timestamps. */
export async function saveSocialProject(
  project: SocialProject
): Promise<SocialProject> {
  const result = await saveProjectStorage(project);
  if (!result.ok) return project;
  await recordRecentProject(result.project);
  return result.project;
}

/** Autosaves a project, skipping the write when the body is unchanged. */
export async function autosaveSocialProject(
  project: SocialProject
): Promise<SocialProject> {
  const result = await autosaveProjectStorage(project);
  if (!result.ok) return project;
  await recordRecentProject(result.project);
  return result.project;
}

/** Renames a project. Returns the updated summary or `null`. */
export async function renameSocialProject(
  id: string,
  title: string
): Promise<SocialProjectSummary | null> {
  const summary = await renameProjectStorage(id, title);
  if (summary) {
    const existing = await getProjectStorage(id);
    if (existing) await recordRecentProject(existing);
  }
  return summary;
}

/** Toggles the favourite flag on a project. */
export async function toggleFavoriteSocialProject(
  id: string
): Promise<SocialProjectSummary | null> {
  const summary = await toggleFavoriteProjectStorage(id);
  if (summary) {
    const existing = await getProjectStorage(id);
    if (existing) await recordRecentProject(existing);
  }
  return summary;
}

/** Duplicates a project and returns the new project. */
export async function duplicateSocialProject(
  id: string
): Promise<SocialProject | null> {
  const copy = await duplicateProjectStorage(id);
  if (copy) await recordRecentProject(copy);
  return copy;
}

/** Soft-deletes a project. */
export async function deleteSocialProject(id: string): Promise<boolean> {
  const ok = await deleteProjectStorage(id);
  if (ok) {
    try {
      await fetch(`/api/socialpilot/projects/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch {
      // Best-effort: the dashboard mirror may be slightly stale until the
      // next page load rebuilds it.
    }
  }
  return ok;
}

/** Lists recent project summaries, newest first. */
export async function listSocialProjects(
  options: { kind?: SocialProjectKind; limit?: number; favoritesOnly?: boolean } = {}
): Promise<SocialProjectSummary[]> {
  const { summaries } = await listProjectsStorage(options);
  return summaries;
}

/**
 * Best-effort mirror of a project into the server-side recent index.
 * Failures here never surface to the user because the project is
 * already saved locally.
 */
async function recordRecentProject(project: SocialProject): Promise<void> {
  try {
    await fetch("/api/socialpilot/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: project.meta.id,
        kind: project.meta.kind,
        title: project.meta.title,
        category: project.meta.category,
        version: project.meta.version,
        size: project.meta.size,
        isFavorite: project.meta.isFavorite,
        updatedAt: project.meta.updatedAt,
      }),
    });
  } catch {
    // The local copy is the source of truth; the mirror is a hint.
  }
}

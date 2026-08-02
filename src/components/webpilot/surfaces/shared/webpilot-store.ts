/**
 * Cross-surface WebPilot store reader.
 *
 * Helper used by surfaces that need a unified view of the
 * project tree, the asset list, and the workspace. Each surface
 * stores its own slice of the project in the body, so this
 * helper reads the slices the session holds, applies the
 * normalisers the rest of the workspace uses, and returns a
 * single typed view the terminal and other surfaces can read
 * from.
 *
 * The terminal is the only Batch 3 surface that needs this
 * snapshot. Batch 2 surfaces keep reading from their own body.
 */

import {
  asAssetsBody,
  asProjectsBody,
  asWorkspaceBody,
} from "@/lib/webpilot";
import type {
  WebAsset,
  WebProjectFile,
  WebProjectFolder,
  WebSession,
} from "@/lib/webpilot";

export interface WebpilotStoreSnapshot {
  /** Project tree (folders + files). */
  project: { folders: WebProjectFolder[]; files: WebProjectFile[] };
  /** Asset list. */
  assets: WebAsset[];
}

/** Read a snapshot of the WebPilot store from a session. */
export function asWebAssets(session: WebSession): WebpilotStoreSnapshot {
  // The session is the only source of truth; we ask each
  // normaliser to read the slice it owns and merge into a
  // single response. The Project Explorer body holds the
  // canonical project tree.
  const projects = asProjectsBody(session.body);
  const assets = asAssetsBody(session.body);
  // The Multi-file Workspace holds its own mirror of the files;
  // we read it for the terminal context so the workspace shell
  // and the terminal agree.
  const workspace = asWorkspaceBody(session.body);
  return {
    project: {
      folders: projects.folders.length > 0 ? projects.folders : workspace.folders,
      files:
        projects.files.length > 0
          ? projects.files.map((file) => ({
              ...file,
              source:
                workspace.files.find((entry) => entry.path === file.path)
                  ?.source ?? file.source,
            }))
          : workspace.files,
    },
    assets: assets.assets,
  };
}

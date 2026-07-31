/**
 * ImagePilot tool registry.
 *
 * Mirrors `src/lib/tools.ts` for PDFPilot so the platform's search and product
 * pages can enumerate ImagePilot the same way they enumerate PDFPilot.
 *
 * The list is *derived* from the workspace descriptors rather than written out
 * again: every tool is a configuration of the one editor, so adding a
 * workspace publishes the tool everywhere with no second list to keep in sync.
 */

import { workspaces, workspaceHref } from "./workspaces";

export type ImageToolCategory = "Edit" | "Enhance" | "Create";

export interface ImageToolDefinition {
  id: string;
  name: string;
  description: string;
  href: string;
  category: ImageToolCategory;
  /** Extra search terms beyond the name and description. */
  keywords: string[];
}

/** Where each workspace belongs in the directory. */
const CATEGORY_BY_WORKSPACE: Record<string, ImageToolCategory> = {
  editor: "Edit",
  screenshot: "Edit",
  watermark: "Create",
  passport: "Create",
  compress: "Enhance",
  background: "Edit",
  blur: "Edit",
  metadata: "Enhance",
  convert: "Enhance",
};

export const imageTools: ImageToolDefinition[] = workspaces.map((workspace) => ({
  id: workspace.id === "editor" ? "image-editor" : workspace.id,
  name: workspace.name,
  description: workspace.tagline,
  href: workspaceHref(workspace),
  category: CATEGORY_BY_WORKSPACE[workspace.id] ?? "Edit",
  keywords: workspace.keywords,
}));

export const imageToolIds = new Set(imageTools.map((tool) => tool.id));

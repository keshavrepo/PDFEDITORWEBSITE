/**
 * ImagePilot tool registry.
 *
 * Mirrors `src/lib/tools.ts` for PDFPilot so the platform's search, navigation
 * and product pages can enumerate ImagePilot the same way they enumerate
 * PDFPilot.
 *
 * The editor is the foundation: the planned tools (background remover,
 * screenshot editor, passport photo, watermark studio and so on) are entry
 * points into the same editor with a task-specific starting state, not
 * separate editors. Adding one means adding an entry here, not rebuilding the
 * canvas.
 */

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

export const imageTools: ImageToolDefinition[] = [
  {
    id: "image-editor",
    name: "Image Editor",
    description: "Layers, adjustments, text and shapes in your browser",
    href: "/imagepilot",
    category: "Edit",
    keywords: [
      "photo editor",
      "image editor",
      "photoshop alternative",
      "layers",
      "crop image",
      "resize image",
      "rotate image",
      "flip image",
      "brightness",
      "contrast",
      "saturation",
      "add text to image",
      "draw shapes",
      "png",
      "jpg",
      "webp",
      "svg",
    ],
  },
];

export const imageToolIds = new Set(imageTools.map((tool) => tool.id));

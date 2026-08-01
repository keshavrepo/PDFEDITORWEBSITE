/**
 * ImagePilot workspaces.
 *
 * A workspace is a task-specific configuration of the *same* editor, not a
 * separate editor. Each one declares which tools to surface, which panels to
 * show, what the default export settings should be and how a freshly imported
 * image is staged. The editor shell reads this configuration; none of the
 * editing, rendering, history or export logic is duplicated.
 *
 * This is what keeps "Screenshot Editor", "Watermark Studio", "Passport Photo"
 * and "Compressor" from becoming four codebases: they are four descriptors
 * over one engine.
 */

import type { EditorToolId, ExportFormat } from "./types";

export type WorkspaceId =
  | "editor"
  | "screenshot"
  | "watermark"
  | "passport"
  | "compress"
  | "background"
  | "blur"
  | "metadata"
  | "convert";

/** Right-hand inspector tabs a workspace can expose. */
export type PanelId =
  | "properties"
  | "adjust"
  | "watermark"
  | "passport"
  | "compress"
  | "background"
  | "blur"
  | "metadata"
  | "convert";

export interface WorkspaceDefinition {
  id: WorkspaceId;
  /** Route segment under `/imagepilot`. The full editor lives at the root. */
  slug: string;
  name: string;
  /** One-line summary used on cards and in search. */
  tagline: string;
  description: string;
  /** Longer copy for the tool's own page header. */
  intro: string;
  /**
   * Tool rail contents. `null` means every tool, which is the full editor.
   * A focused workspace lists only what the task needs so the rail is not a
   * wall of icons.
   */
  tools: EditorToolId[] | null;
  /** Inspector tabs, in order. The first is selected by default. */
  panels: PanelId[];
  /** Default export format for this task. */
  defaultFormat: ExportFormat;
  /** Whether the workspace opens its own dialog immediately on first load. */
  autoImport: boolean;
  /** Search keywords, mirroring how PDFPilot tools are indexed. */
  keywords: string[];
  /** Short bullets shown on the product page. */
  highlights: string[];
}

export const workspaces: WorkspaceDefinition[] = [
  {
    id: "editor",
    slug: "",
    name: "Image Editor",
    tagline: "Layers, adjustments, text and shapes in your browser",
    description:
      "The full ImagePilot editor: layers, undo history, non-destructive adjustments, editable text, shapes, crop and transform.",
    intro:
      "Everything ImagePilot can do, in one workspace. Import an image, work in layers, and export to PNG, JPG, WEBP or SVG.",
    tools: null,
    panels: ["properties", "adjust"],
    defaultFormat: "png",
    autoImport: false,
    keywords: [
      "image editor",
      "photo editor",
      "layers",
      "crop image",
      "resize image",
      "add text to image",
    ],
    highlights: ["Layer-based editing", "17 image operations", "PNG, JPG, WEBP, SVG"],
  },
  {
    id: "screenshot",
    slug: "screenshot-editor",
    name: "Screenshot Editor",
    tagline: "Annotate, redact and polish screenshots",
    description:
      "Mark up screenshots with arrows, boxes, highlights and callouts, and hide sensitive details with blur or pixelation before you share them.",
    intro:
      "Paste a screenshot straight from your clipboard, annotate it, obscure anything private, then copy or download the result. Nothing is uploaded.",
    // Annotation tools only: the marquee and vector polygons are noise here,
    // while redaction needs the region tools.
    tools: ["move", "crop", "text", "rectangle", "ellipse", "arrow", "line", "hand", "zoom"],
    panels: ["properties", "adjust"],
    defaultFormat: "png",
    autoImport: true,
    keywords: [
      "screenshot editor",
      "annotate screenshot",
      "blur screenshot",
      "pixelate screenshot",
      "redact screenshot",
      "highlight",
      "arrow",
      "callout",
    ],
    highlights: ["Arrows, boxes and highlights", "Blur and pixelate", "Clipboard in and out"],
  },
  {
    id: "watermark",
    slug: "watermark-studio",
    name: "Watermark Studio",
    tagline: "Text and image watermarks, single or batch",
    description:
      "Apply a text or logo watermark with control over opacity, rotation, scale and placement, tile it across the image, and run the same settings over a whole batch.",
    intro:
      "Set your watermark once, preview it live, then apply it to one image or a whole batch. Every file is processed on your device.",
    tools: ["move", "text", "hand", "zoom"],
    panels: ["watermark", "properties"],
    defaultFormat: "png",
    autoImport: true,
    keywords: [
      "watermark",
      "add watermark",
      "batch watermark",
      "logo watermark",
      "text watermark",
      "tile watermark",
      "copyright",
    ],
    highlights: ["Text or logo", "Tiling and corner presets", "Batch processing"],
  },
  {
    id: "passport",
    slug: "passport-photo",
    name: "Passport Photo Studio",
    tagline: "Compliant ID photos for major countries",
    description:
      "Crop to an official specification with head-height guides, set a compliant background colour, and lay out a print sheet with multiple copies.",
    intro:
      "Pick a country specification, position the head inside the guides, choose a background, then export a single photo or a print sheet.",
    tools: ["move", "hand", "zoom"],
    panels: ["passport", "adjust"],
    defaultFormat: "jpeg",
    autoImport: true,
    keywords: [
      "passport photo",
      "id photo",
      "visa photo",
      "passport size photo",
      "print layout",
      "biometric photo",
    ],
    highlights: ["Country specifications", "Head-position guides", "Print sheets"],
  },
  {
    id: "compress",
    slug: "compressor",
    name: "Image Compressor",
    tagline: "Shrink JPG, PNG and WEBP with a live preview",
    description:
      "Compress by quality or to a target file size, compare the result against the original before downloading, and process a whole batch at once.",
    intro:
      "Choose a quality level or a target size, check the preview against the original, then download. Lossless is used where the format allows it.",
    tools: ["move", "hand", "zoom"],
    panels: ["compress"],
    defaultFormat: "jpeg",
    autoImport: true,
    keywords: [
      "compress image",
      "image compressor",
      "reduce image size",
      "optimise image",
      "shrink jpg",
      "compress png",
      "compress webp",
      "target file size",
    ],
    highlights: ["Quality or target size", "Before and after preview", "Batch compression"],
  },
  {
    id: "background",
    slug: "background-remover",
    name: "Background Remover",
    tagline: "Cut out a subject and drop in a new backdrop",
    description:
      "Removes a plain or gently graded background with soft-edge matting that preserves hair, then exports a transparent PNG or composites the subject onto a new colour or image.",
    intro:
      "Import a photo, refine the cut-out with the brush if needed, then export it transparent or over a new background. Everything runs on your device.",
    // The brush lives in the panel, so the rail only needs navigation.
    tools: ["move", "hand", "zoom"],
    panels: ["background", "adjust"],
    defaultFormat: "png",
    autoImport: true,
    keywords: [
      "background remover",
      "remove background",
      "transparent png",
      "cut out image",
      "change background colour",
      "product photo background",
      "hair matting",
    ],
    highlights: ["Soft-edge matting", "Brush refinement", "Transparent PNG"],
  },
  {
    id: "blur",
    slug: "object-blur",
    name: "Object Blur Studio",
    tagline: "Hide faces, plates and anything private",
    description:
      "Draw regions over faces, licence plates or documents and obscure them with pixelation, blur or a solid block, with adjustable strength and feathering.",
    intro:
      "Drag a region over anything that should not be shared, pick how strongly to obscure it, then export. Pixelation destroys the detail rather than merely softening it.",
    tools: ["move", "hand", "zoom"],
    panels: ["blur", "properties"],
    defaultFormat: "png",
    autoImport: true,
    keywords: [
      "blur faces",
      "blur licence plate",
      "blur number plate",
      "pixelate image",
      "hide personal information",
      "redact photo",
      "anonymise photo",
    ],
    highlights: ["Face and plate presets", "Pixelate or blur", "Brush and drag regions"],
  },
  {
    id: "metadata",
    slug: "metadata-cleaner",
    name: "Metadata Cleaner",
    tagline: "Strip EXIF, GPS and camera data",
    description:
      "Shows exactly what personal data a photo carries — GPS coordinates, camera serial numbers, author fields — and removes the parts you choose without recompressing the image.",
    intro:
      "Photos routinely carry the location they were taken and the serial number of the camera. See what is in yours, then remove it losslessly.",
    tools: ["move", "hand", "zoom"],
    panels: ["metadata"],
    defaultFormat: "jpeg",
    autoImport: true,
    keywords: [
      "remove exif",
      "metadata cleaner",
      "strip gps from photo",
      "remove location from image",
      "exif viewer",
      "privacy photo",
      "remove camera information",
    ],
    highlights: ["See what is in the file", "Lossless removal", "Batch processing"],
  },
  {
    id: "convert",
    slug: "converter",
    name: "Batch Converter",
    tagline: "Convert, resize and rename in bulk",
    description:
      "Convert many images between JPG, PNG, WEBP, AVIF and BMP at once, resizing and renaming as you go, then download everything as a ZIP.",
    intro:
      "Drop in a folder of images, choose an output format and naming pattern, then download the lot as a ZIP. Nothing is uploaded.",
    tools: ["move", "hand", "zoom"],
    panels: ["convert"],
    defaultFormat: "webp",
    autoImport: true,
    keywords: [
      "batch convert images",
      "image converter",
      "png to jpg",
      "jpg to webp",
      "convert to avif",
      "convert to bmp",
      "bulk rename images",
      "zip download",
    ],
    highlights: ["Five output formats", "Resize and rename", "ZIP download"],
  },
];

export function getWorkspace(id: WorkspaceId): WorkspaceDefinition {
  return workspaces.find((workspace) => workspace.id === id) ?? workspaces[0];
}

export function getWorkspaceBySlug(slug: string): WorkspaceDefinition | undefined {
  return workspaces.find((workspace) => workspace.slug === slug);
}

/** Workspaces other than the full editor, used for directories and search. */
export const focusedWorkspaces = workspaces.filter((workspace) => workspace.id !== "editor");

/** Route for a workspace, e.g. `/imagepilot/screenshot-editor`. */
export function workspaceHref(workspace: WorkspaceDefinition): string {
  return workspace.slug ? `/imagepilot/${workspace.slug}` : "/imagepilot";
}

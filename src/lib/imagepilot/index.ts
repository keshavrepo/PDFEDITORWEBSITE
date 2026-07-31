/**
 * Public entry point for ImagePilot.
 *
 * The editor is designed as a reusable foundation: future ImagePilot tools
 * import the same document model, pixel pipeline, renderer and exporter rather
 * than growing a second editor beside it.
 */

export * from "./core";
export * from "./raster";

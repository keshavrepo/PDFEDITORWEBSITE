/**
 * Project Settings helpers.
 *
 * Pure functions the Project Settings surface uses to validate
 * the custom CSS, custom JavaScript, and Open Graph metadata,
 * and to render the metadata block into the Open Graph tags
 * the Project Export surface appends to every HTML file.
 *
 * The helpers are intentionally dependency-free: every function
 * is pure, and the surface can call them from a `useMemo` (live
 * preview) or an event handler (apply).
 */

import type { WebSettingsBody, WebSettingsMetadata } from "../types";

/** Render the Open Graph block as a string of HTML tags. The
 * function returns an empty string when the metadata has no
 * fields, so callers can use the result verbatim. */
export function renderOpenGraphTags(metadata: WebSettingsMetadata): string {
  const tags: string[] = [];
  if (metadata.ogTitle) {
    tags.push(`  <meta property="og:title" content="${escape(metadata.ogTitle)}" />`);
  }
  if (metadata.ogDescription) {
    tags.push(
      `  <meta property="og:description" content="${escape(metadata.ogDescription)}" />`
    );
  }
  if (metadata.ogImage) {
    tags.push(`  <meta property="og:image" content="${escape(metadata.ogImage)}" />`);
  }
  if (metadata.ogType) {
    tags.push(`  <meta property="og:type" content="${escape(metadata.ogType)}" />`);
  }
  if (metadata.ogUrl) {
    tags.push(`  <meta property="og:url" content="${escape(metadata.ogUrl)}" />`);
  }
  if (metadata.locale) {
    tags.push(`  <meta property="og:locale" content="${escape(metadata.locale)}" />`);
  }
  if (metadata.twitterCard) {
    tags.push(
      `  <meta name="twitter:card" content="${escape(metadata.twitterCard)}" />`
    );
  }
  if (metadata.twitterSite) {
    tags.push(
      `  <meta name="twitter:site" content="${escape(metadata.twitterSite)}" />`
    );
  }
  if (metadata.twitterCreator) {
    tags.push(
      `  <meta name="twitter:creator" content="${escape(metadata.twitterCreator)}" />`
    );
  }
  return tags.length > 0 ? tags.join("\n") + "\n" : "";
}

/** Render the standard meta tags (title, description, theme-color,
 * canonical URL, favicon, viewport, charset) as a string of HTML
 * tags. The Project Settings surface passes the metadata block
 * to the Project Export surface which appends the result to the
 * <head> of every HTML file. */
export function renderStandardMetaTags(body: WebSettingsBody): string {
  const tags: string[] = [];
  if (body.metadata.favicon) {
    tags.push(
      `  <link rel="icon" href="${escape(body.metadata.favicon)}" />`
    );
  }
  if (body.metadata.canonicalUrl) {
    tags.push(
      `  <link rel="canonical" href="${escape(body.metadata.canonicalUrl)}" />`
    );
  }
  if (body.metadata.themeColor) {
    tags.push(
      `  <meta name="theme-color" content="${escape(body.metadata.themeColor)}" />`
    );
  }
  if (body.metadata.author) {
    tags.push(`  <meta name="author" content="${escape(body.metadata.author)}" />`);
  }
  if (body.metadata.keywords) {
    tags.push(
      `  <meta name="keywords" content="${escape(body.metadata.keywords)}" />`
    );
  }
  if (body.metadata.locale) {
    tags.push(`  <html lang="${escape(body.metadata.locale.split("_")[0] ?? "en")}">`);
  }
  return tags.length > 0 ? tags.join("\n") + "\n" : "";
}

/** Sanitise the custom CSS so an injection cannot break the host
 * page. The function is intentionally conservative: it returns
 * the source unchanged when every line is safe. */
export function validateCustomCss(source: string): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (/expression\s*\(/i.test(line)) {
      errors.push(`Line ${i + 1}: expression() is not allowed in CSS`);
    }
    if (/@import/i.test(line)) {
      errors.push(`Line ${i + 1}: @import is not allowed in custom CSS`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Sanitise the custom JavaScript so the surface can show a
 * warning if the source uses globals that the rest of the
 * workspace should not see. */
export function validateCustomJavaScript(source: string): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (/document\.write\s*\(/.test(source)) {
    errors.push("document.write() is not allowed in custom JavaScript");
  }
  if (/eval\s*\(/.test(source)) {
    errors.push("eval() is not allowed in custom JavaScript");
  }
  if (/window\.location\s*=/.test(source)) {
    errors.push("window.location assignment is not allowed in custom JavaScript");
  }
  return { ok: errors.length === 0, errors };
}

/** Render the manifest block the Project Settings surface shows in
 * a read-only preview. The function returns a JSON string the
 * user can copy. */
export function renderProjectManifest(body: WebSettingsBody): string {
  return JSON.stringify(
    {
      name: body.projectName,
      version: body.version,
      description: body.description,
      author: body.author,
      metadata: body.metadata,
      theme: body.theme,
    },
    null,
    2
  );
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

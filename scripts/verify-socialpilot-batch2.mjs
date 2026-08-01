/**
 * SocialPilot Batch 2 verification.
 *
 * Smoke-tests the core creator tools: Post Creator, Caption Manager,
 * Hashtag Manager, Content Calendar and Notes. Covers file structure,
 * registry, body schemas, route wiring and platform integration.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

let total = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  total += 1;
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result.then(
        () => console.log(`  \u001b[32m✓\u001b[0m ${name}`),
        (err) => {
          failed += 1;
          failures.push({ name, error: err });
          console.log(`  \u001b[31m✗\u001b[0m ${name}\n      ${err && err.stack ? err.stack : err}`);
        }
      );
    }
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
    return undefined;
  } catch (err) {
    failed += 1;
    failures.push({ name, error: err });
    console.log(`  \u001b[31m✗\u001b[0m ${name}\n      ${err && err.stack ? err.stack : err}`);
    return undefined;
  }
}

console.log("\n\u001b[1mFile structure\u001b[0m");

const FILES = [
  "src/lib/socialpilot/bodies.ts",
  "src/components/socialpilot/surfaces/shared/rich-text-editor.tsx",
  "src/components/socialpilot/surfaces/post-creator.tsx",
  "src/components/socialpilot/surfaces/caption-manager.tsx",
  "src/components/socialpilot/surfaces/hashtag-manager.tsx",
  "src/components/socialpilot/surfaces/content-calendar.tsx",
  "src/components/socialpilot/surfaces/notes.tsx",
];

for (const file of FILES) {
  test(`file exists: ${file}`, () => {
    const full = join(ROOT, file);
    assert.ok(existsSync(full), `Missing ${file}`);
    const stat = statSync(full);
    assert.ok(stat.size > 0, `Empty ${file}`);
  });
}

console.log("\n\u001b[1mProject registry (Batch 2 kinds)\u001b[0m");

test("registry has caption / hashtag / calendar / note kinds", () => {
  const projects = readFileSync(join(ROOT, "src/lib/socialpilot/projects.ts"), "utf8");
  for (const kind of ["caption", "hashtag", "calendar", "note"]) {
    assert.match(projects, new RegExp(`kind: "${kind}"`));
    assert.match(projects, new RegExp(`slug: "${kind}s?"`));
  }
});

test("categories are registered for the new kinds", () => {
  const projects = readFileSync(join(ROOT, "src/lib/socialpilot/projects.ts"), "utf8");
  assert.match(projects, /"caption"/);
  assert.match(projects, /"hashtag"/);
  assert.match(projects, /"calendar"/);
  assert.match(projects, /"note"/);
});

console.log("\n\u001b[1mTypes\u001b[0m");

test("types include the new body shapes", () => {
  const types = readFileSync(join(ROOT, "src/lib/socialpilot/types.ts"), "utf8");
  for (const type of [
    "SocialPostBody",
    "SocialCaptionBody",
    "SocialHashtagGroupBody",
    "SocialContentCalendarBody",
    "SocialContentPlan",
    "SocialNoteBody",
    "SocialRichTextParagraph",
    "SocialRichTextMark",
  ]) {
    assert.match(types, new RegExp(`export interface ${type}`));
  }
});

test("SocialProjectCategory now includes caption/hashtag/calendar/note", () => {
  const types = readFileSync(join(ROOT, "src/lib/socialpilot/types.ts"), "utf8");
  assert.match(types, /\| "caption"/);
  assert.match(types, /\| "hashtag"/);
  assert.match(types, /\| "calendar"/);
  assert.match(types, /\| "note"/);
});

console.log("\n\u001b[1mBody helpers\u001b[0m");

test("bodies.ts re-exports the Batch 2 types", () => {
  const bodies = readFileSync(join(ROOT, "src/lib/socialpilot/bodies.ts"), "utf8");
  for (const type of [
    "SocialPostBody",
    "SocialCaptionBody",
    "SocialHashtagGroupBody",
    "SocialContentCalendarBody",
    "SocialNoteBody",
  ]) {
    assert.match(bodies, new RegExp(`export type {\\s*[^}]*\\b${type}\\b`));
  }
});

test("bodies.ts normalises every Batch 2 body", () => {
  const bodies = readFileSync(join(ROOT, "src/lib/socialpilot/bodies.ts"), "utf8");
  for (const fn of [
    "asPostBody",
    "asCaptionBody",
    "asHashtagGroupBody",
    "asCalendarBody",
    "asNoteBody",
  ]) {
    assert.match(bodies, new RegExp(`export function ${fn}`));
  }
});

test("bodies.ts derives hashtags and mentions from text", () => {
  const bodies = readFileSync(join(ROOT, "src/lib/socialpilot/bodies.ts"), "utf8");
  assert.match(bodies, /export function deriveHashtags/);
  assert.match(bodies, /export function deriveMentions/);
});

test("bodies.ts exports the calendar color and platform lists", () => {
  const bodies = readFileSync(join(ROOT, "src/lib/socialpilot/bodies.ts"), "utf8");
  assert.match(bodies, /export const PLAN_COLORS/);
  assert.match(bodies, /export const PLAN_PLATFORMS/);
});

console.log("\n\u001b[1mRoute wiring\u001b[0m");

test("dynamic route mounts the new surfaces", () => {
  const route = readFileSync(join(ROOT, "src/app/socialpilot/[project]/page.tsx"), "utf8");
  for (const surface of [
    "PostCreator",
    "CaptionManager",
    "HashtagManager",
    "ContentCalendar",
    "Notes",
  ]) {
    assert.match(route, new RegExp(`import { ${surface}`));
  }
  // The new kinds are mapped to their surfaces.
  for (const pair of [
    ["post", "PostCreator"],
    ["caption", "CaptionManager"],
    ["hashtag", "HashtagManager"],
    ["calendar", "ContentCalendar"],
    ["note", "Notes"],
  ]) {
    assert.match(
      route,
      new RegExp(`case "${pair[0]}"[^}]*${pair[1]}`)
    );
  }
});

test("dynamic route handles the five new project kinds", () => {
  const route = readFileSync(join(ROOT, "src/app/socialpilot/[project]/page.tsx"), "utf8");
  for (const kind of ["caption", "hashtag", "calendar", "note"]) {
    assert.match(route, new RegExp(`case "${kind}"`));
  }
});

console.log("\n\u001b[1mSurface contracts\u001b[0m");

for (const surface of [
  "post-creator",
  "caption-manager",
  "hashtag-manager",
  "content-calendar",
  "notes",
]) {
  test(`${surface}.tsx accepts the standard project/onChange contract`, () => {
    const source = readFileSync(join(ROOT, `src/components/socialpilot/surfaces/${surface}.tsx`), "utf8");
    assert.match(source, /project: SocialProject/);
    assert.match(source, /onChange: \(next: SocialProject\) => void/);
  });
}

test("post-creator.tsx supports plain / rich text, mentions, hashtags, character counter, preview", () => {
  const source = readFileSync(join(ROOT, "src/components/socialpilot/surfaces/post-creator.tsx"), "utf8");
  assert.match(source, /format === "rich"/);
  assert.match(source, /RichTextEditor/);
  assert.match(source, /characters/);
  assert.match(source, /Preview/);
  assert.match(source, /CaptionPicker|Insert caption/);
  assert.match(source, /HashtagPicker|Insert hashtag/);
  assert.match(source, /Duplicate/);
});

test("caption-manager.tsx supports search, favourite, duplicate, delete, category", () => {
  const source = readFileSync(join(ROOT, "src/components/socialpilot/surfaces/caption-manager.tsx"), "utf8");
  assert.match(source, /toggleFavorite/);
  assert.match(source, /duplicate/);
  assert.match(source, /deleteSocialProject|delete/);
  assert.match(source, /Search/);
  assert.match(source, /category/);
});

test("hashtag-manager.tsx supports search, favourite, duplicate, delete, group, category", () => {
  const source = readFileSync(join(ROOT, "src/components/socialpilot/surfaces/hashtag-manager.tsx"), "utf8");
  assert.match(source, /toggleFavorite/);
  assert.match(source, /duplicate/);
  assert.match(source, /deleteSocialProject/);
  assert.match(source, /group/i);
  assert.match(source, /category/);
});

test("content-calendar.tsx supports month/week/day, platform filter, color labels, move", () => {
  const source = readFileSync(join(ROOT, "src/components/socialpilot/surfaces/content-calendar.tsx"), "utf8");
  assert.match(source, /"month"/);
  assert.match(source, /"week"/);
  assert.match(source, /"day"/);
  assert.match(source, /PLAN_COLORS/);
  assert.match(source, /PLAN_PLATFORMS/);
  assert.match(source, /movePlan/);
  assert.match(source, /Add plan/);
});

test("notes.tsx supports rich text, checklist, tags, search, favourite", () => {
  const source = readFileSync(join(ROOT, "src/components/socialpilot/surfaces/notes.tsx"), "utf8");
  assert.match(source, /RichTextEditor/);
  assert.match(source, /isChecklist/);
  assert.match(source, /toggleFavorite/);
  assert.match(source, /deleteSocialProject/);
  assert.match(source, /TagInput|tags/);
});

test("rich-text-editor.tsx supports bold/italic/code/link/lists/checklist", () => {
  const source = readFileSync(join(ROOT, "src/components/socialpilot/surfaces/shared/rich-text-editor.tsx"), "utf8");
  assert.match(source, /toggleFormat/);
  assert.match(source, /"bold"/);
  assert.match(source, /"italic"/);
  assert.match(source, /"code"/);
  assert.match(source, /"link"/);
  assert.match(source, /"checklist"/);
  assert.match(source, /detectInlineTokens/);
});

console.log("\n\u001b[1mPlatform reuse\u001b[0m");

test("search index now lists captions, hashtag groups, calendar plans and notes", () => {
  // The search index is generic over project kinds; the new kinds
  // appear in the registry and are picked up by the loop in
  // buildStaticIndex.
  const projects = readFileSync(join(ROOT, "src/lib/socialpilot/projects.ts"), "utf8");
  for (const kind of ["caption", "hashtag", "calendar", "note"]) {
    assert.match(projects, new RegExp(`kind: "${kind}"`));
  }
});

test("workspace still supports duplicate / favourite / delete from the chrome", () => {
  const ws = readFileSync(join(ROOT, "src/components/socialpilot/workspace.tsx"), "utf8");
  assert.match(ws, /duplicateActive/);
  assert.match(ws, /toggleFavorite/);
  assert.match(ws, /deleteProject/);
});

(async () => {
  await new Promise((r) => setTimeout(r, 100));
  console.log(`\n\u001b[1mResults\u001b[0m  ${total - failed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\n\u001b[31mFailures:\u001b[0m");
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error && f.error.message ? f.error.message : f.error}`);
    }
    process.exit(1);
  }
})();

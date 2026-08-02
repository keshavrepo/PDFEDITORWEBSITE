/**
 * SocialPilot Batch 3 verification.
 *
 * Smoke-tests the professional creator workspace: Publishing Queue,
 * Platform Profiles, Media Workspace, Brand Workspace and Workspace
 * Dashboard. Covers file structure, registry, body schemas, route
 * wiring, surface contracts and platform reuse.
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
  "src/lib/socialpilot/platforms.ts",
  "src/lib/socialpilot/server-state.ts",
  "src/app/api/socialpilot/platform-profiles/route.ts",
  "src/app/api/socialpilot/brand-profiles/route.ts",
  "src/app/api/socialpilot/media-collections/route.ts",
  "src/app/api/socialpilot/user-state/route.ts",
  "src/components/socialpilot/surfaces/publishing-queue.tsx",
  "src/components/socialpilot/surfaces/platform-profiles.tsx",
  "src/components/socialpilot/surfaces/media-workspace.tsx",
  "src/components/socialpilot/surfaces/brand-workspace.tsx",
  "src/components/socialpilot/surfaces/workspace-dashboard.tsx",
];

for (const file of FILES) {
  test(`file exists: ${file}`, () => {
    const full = join(ROOT, file);
    assert.ok(existsSync(full), `Missing ${file}`);
    const stat = statSync(full);
    assert.ok(stat.size > 0, `Empty ${file}`);
  });
}

console.log("\n\u001b[1mProject registry (Batch 3 kinds)\u001b[0m");

test("registry has queue / profile / media / brand / dashboard kinds", () => {
  const projects = readFileSync(join(ROOT, "src/lib/socialpilot/projects.ts"), "utf8");
  for (const kind of ["queue", "profile", "media", "brand", "dashboard"]) {
    assert.match(projects, new RegExp(`kind: "${kind}"`));
  }
});

test("categories are registered for the new kinds", () => {
  const projects = readFileSync(join(ROOT, "src/lib/socialpilot/projects.ts"), "utf8");
  for (const category of ["queue", "profile", "media", "brand"]) {
    assert.match(projects, new RegExp(`${category}:`));
  }
});

console.log("\n\u001b[1mTypes\u001b[0m");

test("types include the Batch 3 body shapes", () => {
  const types = readFileSync(join(ROOT, "src/lib/socialpilot/types.ts"), "utf8");
  for (const type of [
    "SocialQueueBody",
    "SocialQueueItem",
    "SocialQueueStatus",
    "SocialPlatformKey",
    "SocialPlatformMeta",
    "SocialPlatformProfile",
    "SocialBrand",
    "SocialBrandWatermark",
    "SocialBrandTemplate",
    "SocialMediaCollection",
  ]) {
    assert.match(types, new RegExp(`export (interface|type) ${type}`));
  }
});

test("SocialProjectCategory includes the new kinds", () => {
  const types = readFileSync(join(ROOT, "src/lib/socialpilot/types.ts"), "utf8");
  for (const cat of ["queue", "profile", "media", "brand"]) {
    assert.match(types, new RegExp(`\\| "${cat}"`));
  }
});

console.log("\n\u001b[1mBody helpers\u001b[0m");

test("bodies.ts re-exports the Batch 3 types", () => {
  const bodies = readFileSync(join(ROOT, "src/lib/socialpilot/bodies.ts"), "utf8");
  for (const type of [
    "SocialQueueBody",
    "SocialQueueItem",
    "SocialQueueStatus",
    "SocialPlatformKey",
    "SocialPlatformProfile",
    "SocialBrand",
    "SocialMediaCollection",
  ]) {
    assert.match(bodies, new RegExp(`export type {[^}]*\\b${type}\\b`));
  }
});

test("bodies.ts exports the Batch 3 normalisers", () => {
  const bodies = readFileSync(join(ROOT, "src/lib/socialpilot/bodies.ts"), "utf8");
  for (const fn of [
    "asQueueBody",
    "asProfileBody",
    "asMediaBody",
    "asBrandBody",
  ]) {
    assert.match(bodies, new RegExp(`export function ${fn}`));
  }
});

test("bodies.ts exports the platform catalogue", () => {
  const platforms = readFileSync(join(ROOT, "src/lib/socialpilot/platforms.ts"), "utf8");
  assert.match(platforms, /export const PLATFORMS/);
  for (const key of [
    "facebook",
    "instagram",
    "x",
    "linkedin",
    "youtube",
    "tiktok",
    "threads",
    "pinterest",
  ]) {
    assert.match(platforms, new RegExp(`key: "${key}"`));
  }
});

console.log("\n\u001b[1mDatabase schema\u001b[0m");

test("schema declares the Batch 3 tables", () => {
  const schema = readFileSync(join(ROOT, "src/db/schema.ts"), "utf8");
  for (const table of [
    "socialBrandProfiles",
    "socialPlatformProfiles",
    "socialMediaCollections",
    "socialUserState",
  ]) {
    assert.match(schema, new RegExp(`export const ${table} = pgTable`));
  }
});

console.log("\n\u001b[1mAPI routes\u001b[0m");

const API_ROUTES = [
  "src/app/api/socialpilot/platform-profiles/route.ts",
  "src/app/api/socialpilot/brand-profiles/route.ts",
  "src/app/api/socialpilot/media-collections/route.ts",
  "src/app/api/socialpilot/user-state/route.ts",
];

for (const route of API_ROUTES) {
  test(`${route} exports GET and PUT handlers`, () => {
    const source = readFileSync(join(ROOT, route), "utf8");
    assert.match(source, /export async function GET/);
    assert.match(source, /export async function PUT/);
    assert.match(source, /isSameOrigin/);
    assert.match(source, /checkRateLimit/);
  });
}

console.log("\n\u001b[1mRoute wiring\u001b[0m");

test("dynamic route mounts the new surfaces", () => {
  const route = readFileSync(join(ROOT, "src/app/socialpilot/[project]/page.tsx"), "utf8");
  for (const surface of [
    "PublishingQueue",
    "PlatformProfiles",
    "MediaWorkspace",
    "BrandWorkspace",
    "WorkspaceDashboard",
  ]) {
    assert.match(route, new RegExp(`import { ${surface}`));
  }
  for (const pair of [
    ["queue", "PublishingQueue"],
    ["profile", "PlatformProfiles"],
    ["media", "MediaWorkspace"],
    ["brand", "BrandWorkspace"],
    ["blank", "WorkspaceDashboard"],
  ]) {
    assert.match(route, new RegExp(`case "${pair[0]}"[^}]*${pair[1]}`));
  }
});

console.log("\n\u001b[1mSurface contracts\u001b[0m");

for (const surface of [
  "publishing-queue",
  "platform-profiles",
  "media-workspace",
  "brand-workspace",
  "workspace-dashboard",
]) {
  test(`${surface}.tsx accepts the standard project/onChange contract`, () => {
    const source = readFileSync(
      join(ROOT, `src/components/socialpilot/surfaces/${surface}.tsx`),
      "utf8"
    );
    assert.match(source, /project: SocialProject/);
    assert.match(source, /onChange: \(next: SocialProject\) => void/);
  });
}

test("publishing-queue.tsx supports the five statuses, drag-and-drop, bulk actions, filters and search", () => {
  const source = readFileSync(join(ROOT, "src/components/socialpilot/surfaces/publishing-queue.tsx"), "utf8");
  for (const status of ["draft", "ready", "scheduled", "published", "failed"]) {
    assert.match(source, new RegExp(`(?:^|\\b)${status}:`));
  }
  assert.match(source, /draggable/);
  assert.match(source, /onDragStart/);
  assert.match(source, /onDrop/);
  assert.match(source, /applyStatusToSelected/);
  assert.match(source, /deleteSelected/);
  assert.match(source, /statusFilter/);
  assert.match(source, /search/);
  assert.match(source, /priority/);
});

test("platform-profiles.tsx uses the PLATFORMS catalogue, supports default per platform, profile switching", () => {
  const source = readFileSync(join(ROOT, "src/components/socialpilot/surfaces/platform-profiles.tsx"), "utf8");
  assert.match(source, /PLATFORMS/);
  assert.match(source, /isDefault/);
  assert.match(source, /setDefault/);
  // The platform catalogue is the single source of truth for the
  // eight supported platforms.
  const platforms = readFileSync(join(ROOT, "src/lib/socialpilot/platforms.ts"), "utf8");
  for (const platform of [
    "facebook",
    "instagram",
    "x",
    "linkedin",
    "youtube",
    "tiktok",
    "threads",
    "pinterest",
  ]) {
    assert.match(platforms, new RegExp(`key: "${platform}"`));
  }
});

test("media-workspace.tsx supports grid/list, multi-select, drag-and-drop, favourites, tags, collections, search, filters, preview, details panel", () => {
  const source = readFileSync(join(ROOT, "src/components/socialpilot/surfaces/media-workspace.tsx"), "utf8");
  assert.match(source, /view: "grid"/);
  assert.match(source, /view: "list"/);
  assert.match(source, /selectedIds/);
  assert.match(source, /moveSelectedTo/);
  assert.match(source, /toggleFavourite/);
  assert.match(source, /addCollection/);
  assert.match(source, /search/);
  assert.match(source, /kindFilter/);
  assert.match(source, /DetailsPanel/);
});

test("brand-workspace.tsx supports multiple brands, logos, colours, fonts, watermarks, templates, default hashtags and captions, active-brand switcher", () => {
  const source = readFileSync(join(ROOT, "src/components/socialpilot/surfaces/brand-workspace.tsx"), "utf8");
  assert.match(source, /addBrand/);
  assert.match(source, /setActiveBrandIdPersist/);
  assert.match(source, /logos/);
  assert.match(source, /colors/);
  assert.match(source, /fonts/);
  assert.match(source, /watermarks/);
  assert.match(source, /templates/);
  assert.match(source, /defaultHashtags/);
  assert.match(source, /defaultCaptions/);
});

test("workspace-dashboard.tsx surfaces recent projects, recent assets, favourites, active brand, active profile, queue summary", () => {
  const source = readFileSync(join(ROOT, "src/components/socialpilot/surfaces/workspace-dashboard.tsx"), "utf8");
  assert.match(source, /Recent projects/);
  assert.match(source, /Recent assets/);
  assert.match(source, /Favourite assets/);
  assert.match(source, /Favourite captions/);
  assert.match(source, /Favourite hashtag groups/);
  assert.match(source, /Active brand/);
  assert.match(source, /Active platform profile/);
  assert.match(source, /Publishing queue summary/);
});

console.log("\n\u001b[1mServer helpers\u001b[0m");

test("server-state.ts has every CRUD helper", () => {
  const source = readFileSync(join(ROOT, "src/lib/socialpilot/server-state.ts"), "utf8");
  for (const fn of [
    "getBrandProfiles",
    "saveBrandProfiles",
    "getPlatformProfiles",
    "savePlatformProfiles",
    "getMediaCollections",
    "saveMediaCollections",
    "getUserState",
    "saveUserState",
  ]) {
    assert.match(source, new RegExp(`export async function ${fn}`));
  }
});

console.log("\n\u001b[1mPlatform reuse\u001b[0m");

test("workspace still supports duplicate / favourite / delete from the chrome", () => {
  const ws = readFileSync(join(ROOT, "src/components/socialpilot/workspace.tsx"), "utf8");
  assert.match(ws, /duplicateActive/);
  assert.match(ws, /toggleFavorite/);
  assert.match(ws, /deleteProject/);
});

test("client barrel does not re-export server-state (it pulls in the DB)", () => {
  const index = readFileSync(join(ROOT, "src/lib/socialpilot/index.ts"), "utf8");
  assert.doesNotMatch(index, /from "\.\/server-state"/);
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

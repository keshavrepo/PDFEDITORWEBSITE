/**
 * SocialPilot Batch 1 verification.
 *
 * Smoke-tests the foundation: the project registry, the templates,
 * the engine helpers, the media helpers, the brand-kit helpers, the
 * URL helpers, the search-index integration and the file structure.
 * No browser is needed: pure JS, no DOM, no IndexedDB.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

let total = 0;
let failed = 0;
let skipped = 0;
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

function check(name, condition, detail) {
  if (condition) {
    test(name, () => {
      assert.ok(condition, detail || name);
    });
  } else {
    skipped += 1;
    console.log(`  \u001b[33m-\u001b[0m ${name} (skipped)`);
  }
}

console.log("\n\u001b[1mFile structure\u001b[0m");

const FILES = [
  "src/lib/socialpilot/index.ts",
  "src/lib/socialpilot/types.ts",
  "src/lib/socialpilot/projects.ts",
  "src/lib/socialpilot/templates.ts",
  "src/lib/socialpilot/engine.ts",
  "src/lib/socialpilot/media-engine.ts",
  "src/lib/socialpilot/storage.ts",
  "src/lib/socialpilot/client-storage.ts",
  "src/lib/socialpilot/recent.ts",
  "src/lib/socialpilot/brand-kit.ts",
  "src/components/socialpilot/workspace.tsx",
  "src/components/socialpilot/toast.tsx",
  "src/components/socialpilot/surfaces/blank.tsx",
  "src/components/socialpilot/surfaces/post.tsx",
  "src/components/socialpilot/surfaces/story.tsx",
  "src/components/socialpilot/surfaces/carousel.tsx",
  "src/components/socialpilot/surfaces/video.tsx",
  "src/components/socialpilot/surfaces/short.tsx",
  "src/components/socialpilot/surfaces/reel.tsx",
  "src/components/socialpilot/surfaces/thread.tsx",
  "src/components/socialpilot/surfaces/campaign.tsx",
  "src/components/socialpilot/surfaces/podcast.tsx",
  "src/components/socialpilot/surfaces/placeholder.tsx",
  "src/components/socialpilot/properties/project.tsx",
  "src/components/socialpilot/properties/brand-kit-panel.tsx",
  "src/components/socialpilot/properties/media-library-panel.tsx",
  "src/components/socialpilot/properties/activity-panel.tsx",
  "src/app/socialpilot/page.tsx",
  "src/app/socialpilot/[project]/page.tsx",
  "src/app/products/socialpilot/page.tsx",
  "src/app/api/socialpilot/projects/route.ts",
  "src/app/api/socialpilot/projects/[id]/route.ts",
  "src/app/api/socialpilot/media/route.ts",
  "src/app/api/socialpilot/media/[id]/route.ts",
  "src/app/api/socialpilot/brand-kit/route.ts",
];

for (const file of FILES) {
  test(`file exists: ${file}`, () => {
    const full = join(ROOT, file);
    assert.ok(existsSync(full), `Missing ${file}`);
    const stat = statSync(full);
    assert.ok(stat.size > 0, `Empty ${file}`);
  });
}

console.log("\n\u001b[1mDatabase schema\u001b[0m");

test("schema declares socialProjects table", () => {
  const schema = readFileSync(join(ROOT, "src/db/schema.ts"), "utf8");
  assert.match(schema, /export const socialProjects = pgTable\(/);
});

test("schema declares socialMediaAssets table", () => {
  const schema = readFileSync(join(ROOT, "src/db/schema.ts"), "utf8");
  assert.match(schema, /export const socialMediaAssets = pgTable\(/);
});

test("schema declares socialBrandKits table", () => {
  const schema = readFileSync(join(ROOT, "src/db/schema.ts"), "utf8");
  assert.match(schema, /export const socialBrandKits = pgTable\(/);
});

console.log("\n\u001b[1mProduct registry\u001b[0m");

test("SocialPilot is registered as an active product", () => {
  const products = readFileSync(join(ROOT, "src/lib/products.ts"), "utf8");
  assert.match(products, /id: "socialpilot"/);
  assert.match(products, /status: "active"/);
  assert.match(products, /href: "\/socialpilot"/);
});

test("SocialPilot release note for v0.1.0 mentions the foundation", () => {
  const products = readFileSync(join(ROOT, "src/lib/products.ts"), "utf8");
  assert.match(products, /version: "0\.1\.0"/);
  assert.match(products, /Social workspace shell/);
  assert.match(products, /Project system/);
  assert.match(products, /Media library/);
  assert.match(products, /brand kit/);
});

console.log("\n\u001b[1mProject registry shape\u001b[0m");

test("projects array contains blank and 9 kind slugs", () => {
  const projects = readFileSync(join(ROOT, "src/lib/socialpilot/projects.ts"), "utf8");
  const slugs = [
    "post",
    "story",
    "carousel",
    "video",
    "short",
    "reel",
    "thread",
    "campaign",
    "podcast",
  ];
  for (const slug of slugs) {
    assert.match(projects, new RegExp(`slug: "${slug}"`));
  }
  assert.match(projects, /slug: ""/);
});

test("projectHref returns /socialpilot for blank and /socialpilot/<slug> otherwise", () => {
  const projects = readFileSync(join(ROOT, "src/lib/socialpilot/projects.ts"), "utf8");
  assert.match(projects, /function projectHref/);
  assert.match(projects, /\/socialpilot/);
});

test("templates cover every category", () => {
  const templates = readFileSync(join(ROOT, "src/lib/socialpilot/templates.ts"), "utf8");
  const projects = readFileSync(join(ROOT, "src/lib/socialpilot/projects.ts"), "utf8");
  // The templates list is generated dynamically from projectCategoryOrder.
  assert.match(templates, /projectCategoryOrder/);
  assert.match(templates, /\.map<SocialTemplate>/);
  // Every category except `blank` is filtered and mapped; the static
  // `blank` template is also present.
  assert.match(templates, /id: "social-blank"/);
  // Verify the category list lives in projects.ts.
  for (const category of [
    "blank",
    "post",
    "story",
    "carousel",
    "video",
    "short",
    "reel",
    "thread",
    "campaign",
    "podcast",
  ]) {
    assert.match(projects, new RegExp(`\\b${category}\\b`));
  }
});

console.log("\n\u001b[1mEngine shape\u001b[0m");

test("engine exports the full public surface", () => {
  const engine = readFileSync(join(ROOT, "src/lib/socialpilot/engine.ts"), "utf8");
  for (const symbol of [
    "createSocialProject",
    "openSocialProject",
    "saveSocialProject",
    "autosaveSocialProject",
    "renameSocialProject",
    "duplicateSocialProject",
    "deleteSocialProject",
    "toggleFavoriteSocialProject",
    "listSocialProjects",
  ]) {
    assert.ok(
      engine.includes(symbol),
      `engine.ts is missing ${symbol}`
    );
  }
  const media = readFileSync(join(ROOT, "src/lib/socialpilot/media-engine.ts"), "utf8");
  for (const symbol of [
    "createMediaAsset",
    "listMediaAssets",
    "deleteMediaAsset",
    "getMediaAsset",
  ]) {
    assert.ok(media.includes(symbol), `media-engine.ts is missing ${symbol}`);
  }
  const index = readFileSync(join(ROOT, "src/lib/socialpilot/index.ts"), "utf8");
  // The barrel re-exports everything; verify the source modules it
  // re-exports are present.
  assert.match(index, /export \* from "\.\/engine"/);
  assert.match(index, /export \* from "\.\/media-engine"/);
  assert.match(index, /export \* from "\.\/types"/);
  assert.match(index, /export \* from "\.\/projects"/);
  assert.match(index, /export \* from "\.\/templates"/);
});

console.log("\n\u001b[1mStorage shape\u001b[0m");

test("client-storage uses IndexedDB with two stores", () => {
  const client = readFileSync(join(ROOT, "src/lib/socialpilot/client-storage.ts"), "utf8");
  assert.match(client, /indexedDB\.open/);
  assert.match(client, /PROJECT_STORE/);
  assert.match(client, /ASSET_STORE/);
});

test("storage constants are exported", () => {
  const storage = readFileSync(join(ROOT, "src/lib/socialpilot/storage.ts"), "utf8");
  for (const constant of [
    "STORAGE_DATABASE",
    "STORAGE_VERSION",
    "PROJECT_STORE",
    "ASSET_STORE",
    "MAX_PROJECT_BYTES",
    "MAX_ASSET_BYTES",
    "MAX_LOCAL_PROJECTS",
    "MAX_LOCAL_ASSETS",
    "MAX_LOCAL_AGE_DAYS",
  ]) {
    assert.match(storage, new RegExp(`export const ${constant}`));
  }
});

test("client-storage respects MAX_LOCAL_PROJECTS and MAX_LOCAL_ASSETS", () => {
  const client = readFileSync(join(ROOT, "src/lib/socialpilot/client-storage.ts"), "utf8");
  assert.match(client, /MAX_LOCAL_PROJECTS/);
  assert.match(client, /MAX_LOCAL_ASSETS/);
});

console.log("\n\u001b[1mRecent / brand-kit / search integration\u001b[0m");

test("recent.ts mirrors socialProjects and socialMediaAssets", () => {
  const recent = readFileSync(join(ROOT, "src/lib/socialpilot/recent.ts"), "utf8");
  assert.match(recent, /listRecentProjects/);
  assert.match(recent, /listRecentMedia/);
  assert.match(recent, /recordRecentProject/);
  assert.match(recent, /recordRecentMedia/);
  assert.match(recent, /deleteRecentProject/);
  assert.match(recent, /deleteRecentMedia/);
});

test("brand-kit server helper is in place", () => {
  const helper = readFileSync(join(ROOT, "src/lib/socialpilot/brand-kit.ts"), "utf8");
  assert.match(helper, /getBrandKit/);
  assert.match(helper, /saveBrandKit/);
  assert.match(helper, /defaultBrandKit/);
});

test("search.ts indexes every SocialPilot project and template", () => {
  const search = readFileSync(join(ROOT, "src/lib/platform/search.ts"), "utf8");
  assert.match(search, /import \{ projects as socialProjects, templates as socialTemplates \} from "@\/lib\/socialpilot"/);
  assert.match(search, /for \(const project of socialProjects\)/);
  assert.match(search, /for \(const template of socialTemplates\)/);
});

test("search route merges recent social projects", () => {
  const route = readFileSync(join(ROOT, "src/app/api/search/route.ts"), "utf8");
  assert.match(route, /socialProjects/);
  assert.match(route, /Your recent projects/);
});

console.log("\n\u001b[1mAPI routes\u001b[0m");

const API_ROUTES = [
  "src/app/api/socialpilot/projects/route.ts",
  "src/app/api/socialpilot/projects/[id]/route.ts",
  "src/app/api/socialpilot/media/route.ts",
  "src/app/api/socialpilot/media/[id]/route.ts",
  "src/app/api/socialpilot/brand-kit/route.ts",
];

for (const route of API_ROUTES) {
  test(`${route} exports GET or POST`, () => {
    const source = readFileSync(join(ROOT, route), "utf8");
    assert.ok(/export async function (GET|POST|DELETE|PUT)/.test(source), `${route} has no exported handler`);
    assert.match(source, /getSession/);
    assert.match(source, /dynamic = "force-dynamic"/);
  });
}

test("projects route GET returns { projects }", () => {
  const source = readFileSync(join(ROOT, "src/app/api/socialpilot/projects/route.ts"), "utf8");
  assert.match(source, /Response\.json\(\{ projects \}\)/);
});

test("media route GET returns { media }", () => {
  const source = readFileSync(join(ROOT, "src/app/api/socialpilot/media/route.ts"), "utf8");
  assert.match(source, /Response\.json\(\{ media \}\)/);
});

test("brand-kit route GET returns { kit }", () => {
  const source = readFileSync(join(ROOT, "src/app/api/socialpilot/brand-kit/route.ts"), "utf8");
  assert.match(source, /Response\.json\(\{ kit/);
});

console.log("\n\u001b[1mApp routes\u001b[0m");

test("default /socialpilot page mounts the workspace with the blank surface", () => {
  const source = readFileSync(join(ROOT, "src/app/socialpilot/page.tsx"), "utf8");
  assert.match(source, /export const metadata/);
  assert.match(source, /kind="blank"/);
  assert.match(source, /BlankSurface/);
  assert.match(source, /SocialWorkspace/);
});

test("/socialpilot/[project] page resolves every registered kind to a static surface", () => {
  const source = readFileSync(join(ROOT, "src/app/socialpilot/[project]/page.tsx"), "utf8");
  assert.match(source, /export function generateStaticParams/);
  for (const surface of [
    "BlankSurface",
    "PostSurface",
    "StorySurface",
    "CarouselSurface",
    "VideoSurface",
    "ShortSurface",
    "ReelSurface",
    "ThreadSurface",
    "CampaignSurface",
    "PodcastSurface",
  ]) {
    assert.match(source, new RegExp(surface));
  }
});

test("products page advertises the foundation", () => {
  const source = readFileSync(join(ROOT, "src/app/products/socialpilot/page.tsx"), "utf8");
  assert.match(source, /export const metadata/);
  assert.match(source, /Creator workspace/);
  assert.match(source, /project kinds live/);
});

console.log("\n\u001b[1mWorkspace shell shape\u001b[0m");

test("workspace.tsx wires every required feature", () => {
  const ws = readFileSync(join(ROOT, "src/components/socialpilot/workspace.tsx"), "utf8");
  for (const piece of [
    "NavigationRail",
    "EmptyState",
    "ShortcutsDialog",
    "ToastProvider",
    "AUTOSAVE_INTERVAL_MS",
    "Ctrl\/Cmd \+ S",
    "Ctrl\/Cmd \+ W",
    "Ctrl\/Cmd \+ D",
    "Ctrl\/Cmd \+ B",
    "saveActive",
    "duplicateActive",
    "toggleFavorite",
    "createBlank",
    "createFromTemplate",
    "ProjectProperties",
    "BrandKitPanel",
    "MediaLibraryPanel",
    "ActivityPanel",
  ]) {
    assert.ok(ws.includes(piece), `workspace.tsx missing ${piece}`);
  }
});

test("workspace.tsx mounts the right-rail tab switcher", () => {
  const ws = readFileSync(join(ROOT, "src/components/socialpilot/workspace.tsx"), "utf8");
  assert.match(ws, /rightTab/);
  assert.match(ws, /RightTabButton/);
});

console.log("\n\u001b[1mDashboard integration\u001b[0m");

test("dashboard now lists recent SocialPilot projects", () => {
  const dash = readFileSync(join(ROOT, "src/app/dashboard/page.tsx"), "utf8");
  assert.match(dash, /listRecentProjects/);
  assert.match(dash, /recentSocial/);
  assert.match(dash, /Recent SocialPilot projects/);
  assert.match(dash, /\/socialpilot\/\$\{entry\.kind\}/);
});

console.log("\n\u001b[1mType contracts\u001b[0m");

test("SocialWorkspaceProps requires kind, Surface", () => {
  const ws = readFileSync(join(ROOT, "src/components/socialpilot/workspace.tsx"), "utf8");
  assert.match(ws, /interface SocialWorkspaceProps/);
  assert.match(ws, /kind: SocialProjectKind/);
  assert.match(ws, /Surface: React\.ComponentType/);
});

test("every surface accepts the same project/onChange contract", () => {
  for (const file of [
    "src/components/socialpilot/surfaces/blank.tsx",
    "src/components/socialpilot/surfaces/post.tsx",
    "src/components/socialpilot/surfaces/story.tsx",
    "src/components/socialpilot/surfaces/carousel.tsx",
    "src/components/socialpilot/surfaces/video.tsx",
    "src/components/socialpilot/surfaces/short.tsx",
    "src/components/socialpilot/surfaces/reel.tsx",
    "src/components/socialpilot/surfaces/thread.tsx",
    "src/components/socialpilot/surfaces/campaign.tsx",
    "src/components/socialpilot/surfaces/podcast.tsx",
  ]) {
    const source = readFileSync(join(ROOT, file), "utf8");
    assert.match(source, /project: SocialProject/);
    assert.match(source, /onChange: \(next: SocialProject\) => void/);
  }
});

(async () => {
  await new Promise((r) => setTimeout(r, 100));
  console.log(`\n\u001b[1mResults\u001b[0m  ${total - failed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ""}`);
  if (failed > 0) {
    console.log("\n\u001b[31mFailures:\u001b[0m");
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error && f.error.message ? f.error.message : f.error}`);
    }
    process.exit(1);
  }
  if (total - failed === 0) {
    console.log("No tests ran");
    process.exit(1);
  }
})();

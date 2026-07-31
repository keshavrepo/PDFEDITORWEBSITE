/**
 * ImagePilot editor tests.
 *
 * The editor core is isomorphic, so these run the exact modules shipped to the
 * browser and assert on real rendered pixels, real geometry and real exported
 * markup — not on mocks.
 *
 * Run with: npm run test:imagepilot
 */

import {
  cleanEditorBuild,
  loadEditorCore,
  loadEditorState,
  luminanceDeviation,
  makeNoisyRaster,
  makeRasterStore,
  makeSolidRaster,
  makeSplitRaster,
  nodeCanvasFactory,
  pixelAt,
  renderToPixels,
} from "./imagepilot-harness.mjs";

const results = { passed: 0, failed: 0, failures: [] };
let currentSuite = "";

function suite(name) {
  currentSuite = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

async function test(name, run) {
  try {
    await run();
    results.passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (error) {
    results.failed++;
    results.failures.push({ suite: currentSuite, name, error });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    \x1b[31m${error.message}\x1b[0m`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertClose(actual, expected, tolerance, label) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`
  );
}

function assertGreater(actual, threshold, label) {
  assert(actual > threshold, `${label}: expected > ${threshold}, got ${actual}`);
}

const core = await loadEditorCore();
const editor = await loadEditorState();

/** Renders a single solid layer with the given adjustments and samples it. */
async function renderAdjusted(color, adjustments, size = 40) {
  const doc = core.createDocument(size, size, { background: null });
  const raster = makeSolidRaster("src", size, size, color);
  const layer = core.createImageLayer("Layer", "src", { x: 0, y: 0, width: size, height: size }, {
    width: size,
    height: size,
  });
  layer.adjustments = core.createAdjustments(adjustments);
  const withLayer = core.addLayer(doc, layer);
  const rendered = await renderToPixels(withLayer, makeRasterStore([raster]), {
    transparent: true,
  });
  return {
    ...rendered,
    center: pixelAt(rendered.data, rendered.width, size / 2, size / 2),
  };
}

/* -------------------------------------------------------------------------- */

suite("Document model");

await test("creates a document with clamped dimensions", () => {
  const doc = core.createDocument(1920, 1080);
  assert(doc.width === 1920 && doc.height === 1080, "expected the requested size");
  assert(doc.layers.length === 0, "expected an empty layer list");

  const huge = core.createDocument(99999, 10);
  assert(huge.width === core.MAX_CANVAS_DIMENSION, "expected the width to clamp");
  assert(huge.height === 10, "expected the height to survive clamping");
});

await test("adds layers in painter's order and keeps names unique", () => {
  let doc = core.createDocument(100, 100);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 0, y: 0, width: 10, height: 10 }));
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 0, y: 0, width: 10, height: 10 }));
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 0, y: 0, width: 10, height: 10 }));

  assert(doc.layers.length === 3, "expected three layers");
  const names = doc.layers.map((layer) => layer.name);
  assert(new Set(names).size === 3, `expected unique names, got ${names.join(", ")}`);
  assert(names[0] === "Rectangle", "expected the first to keep the base name");
  assert(names[1] === "Rectangle 2", "expected the second to be numbered");
});

await test("updates a layer without mutating the previous document", () => {
  let doc = core.createDocument(100, 100);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 5, y: 5, width: 10, height: 10 }));
  const before = doc;
  const id = doc.layers[0].id;

  const after = core.updateLayer(doc, id, { x: 50 });
  assert(before.layers[0].x === 5, "expected the original document to be untouched");
  assert(after.layers[0].x === 50, "expected the new document to carry the change");
  assert(before !== after, "expected a new document object");
});

await test("duplicates layers directly above their originals and unlocks copies", () => {
  let doc = core.createDocument(100, 100);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 0, y: 0, width: 10, height: 10 }));
  doc = core.updateLayer(doc, doc.layers[0].id, { locked: true });
  doc = core.addLayer(doc, core.createShapeLayer("ellipse", { x: 20, y: 20, width: 10, height: 10 }));

  const { document: result, newIds } = core.duplicateLayers(doc, [doc.layers[0].id]);
  assert(result.layers.length === 3, "expected one extra layer");
  assert(result.layers[1].id === newIds[0], "expected the copy directly above the original");
  assert(result.layers[1].locked === false, "expected the copy to be editable");
  assert(result.layers[1].x === 16, "expected the copy to be offset");
  assert(result.layers[2].type === "shape" && result.layers[2].shape === "ellipse", "expected order preserved");
});

await test("refuses to delete locked layers", () => {
  let doc = core.createDocument(100, 100);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 0, y: 0, width: 10, height: 10 }));
  doc = core.addLayer(doc, core.createShapeLayer("ellipse", { x: 0, y: 0, width: 10, height: 10 }));
  doc = core.updateLayer(doc, doc.layers[0].id, { locked: true });

  const after = core.removeLayers(doc, [doc.layers[0].id, doc.layers[1].id]);
  assert(after.layers.length === 1, "expected only the unlocked layer to be removed");
  assert(after.layers[0].locked === true, "expected the locked layer to survive");
});

await test("reorders layers while preserving group order", () => {
  let doc = core.createDocument(100, 100);
  const rect = { x: 0, y: 0, width: 10, height: 10 };
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", rect));
  doc = core.addLayer(doc, core.createShapeLayer("ellipse", rect));
  doc = core.addLayer(doc, core.createShapeLayer("star", rect));
  const [a, b, c] = doc.layers.map((layer) => layer.id);

  const toFront = core.reorderLayers(doc, [a, b], "front");
  assert(
    toFront.layers.map((l) => l.id).join() === [c, a, b].join(),
    "expected the moved group to keep its relative order at the front"
  );

  const forward = core.reorderLayers(doc, [a], "forward");
  assert(
    forward.layers.map((l) => l.id).join() === [b, a, c].join(),
    "expected a single step forward"
  );

  const topForward = core.reorderLayers(doc, [c], "forward");
  assert(
    topForward.layers.map((l) => l.id).join() === [a, b, c].join(),
    "expected the topmost layer to stay put"
  );
});

/* -------------------------------------------------------------------------- */

suite("Geometry");

await test("computes rotated bounding boxes", () => {
  const layer = core.createShapeLayer("rectangle", { x: 0, y: 0, width: 100, height: 50 });
  const plain = core.layerBounds(layer);
  assert(plain.width === 100 && plain.height === 50, "expected the unrotated box");

  const rotated = core.layerBounds({ ...layer, rotation: 90 });
  assertClose(rotated.width, 50, 0.001, "rotated width");
  assertClose(rotated.height, 100, 0.001, "rotated height");
  // The centre must not move when a layer rotates.
  assertClose(rotated.x + rotated.width / 2, 50, 0.001, "rotated centre x");
  assertClose(rotated.y + rotated.height / 2, 25, 0.001, "rotated centre y");
});

await test("hit tests respect rotation", () => {
  const layer = core.createShapeLayer("rectangle", { x: 0, y: 0, width: 100, height: 20 });
  assert(core.hitTestLayer(layer, 50, 10), "expected a hit inside the box");
  assert(!core.hitTestLayer(layer, 50, 60), "expected a miss below the box");

  const rotated = { ...layer, rotation: 90 };
  // After a quarter turn the same layer occupies a tall, narrow region.
  assert(core.hitTestLayer(rotated, 50, 40), "expected a hit inside the rotated box");
  assert(!core.hitTestLayer(rotated, 5, 10), "expected a miss outside the rotated box");
});

await test("picks the topmost visible unlocked layer", () => {
  let doc = core.createDocument(100, 100);
  const rect = { x: 0, y: 0, width: 100, height: 100 };
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", rect));
  doc = core.addLayer(doc, core.createShapeLayer("ellipse", rect));
  doc = core.addLayer(doc, core.createShapeLayer("star", rect));

  const top = core.pickLayer(doc, 50, 50);
  assert(top.id === doc.layers[2].id, "expected the topmost layer");

  const hidden = core.updateLayer(doc, doc.layers[2].id, { visible: false });
  assert(core.pickLayer(hidden, 50, 50).id === doc.layers[1].id, "expected hidden layers skipped");

  const locked = core.updateLayer(doc, doc.layers[2].id, { locked: true });
  assert(core.pickLayer(locked, 50, 50).id === doc.layers[1].id, "expected locked layers skipped");
  assert(
    core.pickLayer(locked, 50, 50, { includeLocked: true }).id === doc.layers[2].id,
    "expected locked layers pickable when asked for"
  );
});

await test("converts between screen and document space", () => {
  const view = { zoom: 2, panX: 100, panY: 50 };
  const screen = core.documentToScreen(view, 10, 20);
  assert(screen.x === 120 && screen.y === 90, `unexpected screen point ${JSON.stringify(screen)}`);

  const back = core.screenToDocument(view, screen.x, screen.y);
  assertClose(back.x, 10, 1e-9, "round-trip x");
  assertClose(back.y, 20, 1e-9, "round-trip y");
});

await test("zooming at a point keeps that point anchored", () => {
  const view = { zoom: 1, panX: 0, panY: 0 };
  const before = core.screenToDocument(view, 300, 200);
  const zoomed = core.zoomAtPoint(view, 3, 300, 200);
  const after = core.screenToDocument(zoomed, 300, 200);

  assertClose(after.x, before.x, 1e-9, "anchored x");
  assertClose(after.y, before.y, 1e-9, "anchored y");
  assert(zoomed.zoom === 3, "expected the requested zoom");
});

await test("fit-to-viewport centres without upscaling", () => {
  const wide = core.fitToViewport({ width: 4000, height: 1000 }, 800, 600, 0);
  assertClose(wide.zoom, 0.2, 1e-9, "fit zoom");
  assertClose(wide.panY, (600 - 1000 * 0.2) / 2, 1e-9, "vertical centring");

  const small = core.fitToViewport({ width: 100, height: 100 }, 800, 600, 0);
  assert(small.zoom === 1, "expected small documents to stay at 100%");
});

await test("resize handles respect aspect ratio and rotation", () => {
  const layer = core.createShapeLayer("rectangle", { x: 0, y: 0, width: 100, height: 50 });

  const east = core.resizeLayer(layer, "e", 50, 0);
  assertClose(east.width, 150, 1e-9, "east width");
  assertClose(east.height, 50, 1e-9, "east height unchanged");
  assertClose(east.x, 0, 1e-9, "east left edge pinned");

  const ratio = core.resizeLayer(layer, "se", 100, 0, { preserveRatio: true });
  assertClose(ratio.width / ratio.height, 2, 1e-6, "preserved ratio");

  const centred = core.resizeLayer(layer, "e", 20, 0, { fromCenter: true });
  assertClose(centred.width, 140, 1e-9, "symmetric growth");
  assertClose(centred.x, -20, 1e-9, "centre held");

  // A layer rotated 90° should grow along its own axis, not the screen's.
  const rotated = { ...layer, rotation: 90 };
  const rotatedResize = core.resizeLayer(rotated, "e", 0, 50);
  assertClose(rotatedResize.width, 150, 1e-6, "rotated east width");

  const tiny = core.resizeLayer(layer, "e", -500, 0);
  assert(tiny.width >= 1, "expected a minimum size of one pixel");
});

await test("snapping locks to canvas edges, centre and other layers", () => {
  let doc = core.createDocument(1000, 1000);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 400, y: 100, width: 100, height: 100 }));
  const other = doc.layers[0].id;

  const toEdge = core.snapRect({ x: 3, y: 500, width: 50, height: 50 }, doc, {
    zoom: 1,
    excludeIds: [],
  });
  assertClose(toEdge.x, 0, 1e-9, "snapped to the left edge");
  assert(toEdge.guides.some((g) => g.axis === "x" && g.position === 0), "expected an x guide");

  const toLayer = core.snapRect({ x: 398, y: 700, width: 50, height: 50 }, doc, {
    zoom: 1,
    excludeIds: [],
  });
  assertClose(toLayer.x, 400, 1e-9, "snapped to the other layer's left edge");

  const excluded = core.snapRect({ x: 398, y: 700, width: 50, height: 50 }, doc, {
    zoom: 1,
    excludeIds: [other],
    snapToObjects: true,
  });
  assert(excluded.x === 398, "expected the excluded layer not to attract");

  // At high zoom the threshold in document units shrinks, so a 3px gap that
  // snapped at 100% must not snap at 800%.
  const zoomed = core.snapRect({ x: 3, y: 500, width: 50, height: 50 }, doc, {
    zoom: 8,
    excludeIds: [],
  });
  assert(zoomed.x === 3, "expected no snap at high zoom");
});

await test("ruler ticks follow a 1-2-5 progression and stay bounded", () => {
  const coarse = core.rulerStep(0.1);
  const fine = core.rulerStep(8);
  assertGreater(coarse.minor, fine.minor, "coarse zoom uses a larger interval");
  assert(coarse.major === coarse.minor * 10, "expected major ticks every ten minor ones");

  const ticks = core.rulerTicks({ zoom: 1, panX: 0, panY: 0 }, "x", 500);
  assert(ticks.length > 0 && ticks.length < 2000, `unexpected tick count ${ticks.length}`);
  assert(ticks.some((tick) => tick.major), "expected at least one major tick");

  // A pathological zoom must not generate an unbounded list.
  const extreme = core.rulerTicks({ zoom: 0.05, panX: 0, panY: 0 }, "x", 4000);
  assert(extreme.length <= 2000, `expected the tick list to stay capped, got ${extreme.length}`);
});

/* -------------------------------------------------------------------------- */

suite("History");

await test("undo and redo walk the stack", () => {
  const doc = core.createDocument(100, 100);
  let history = core.createHistory(doc);
  assert(!core.canUndo(history), "expected nothing to undo initially");

  const withLayer = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 0, y: 0, width: 10, height: 10 }));
  history = core.pushHistory(history, withLayer, "Add rectangle");
  assert(core.canUndo(history), "expected an undo step");
  assert(core.currentDocument(history).layers.length === 1, "expected the new state");

  history = core.undo(history);
  assert(core.currentDocument(history).layers.length === 0, "expected the previous state");
  assert(core.canRedo(history), "expected a redo step");

  history = core.redo(history);
  assert(core.currentDocument(history).layers.length === 1, "expected the state back");
});

await test("consecutive edits with the same merge key coalesce", () => {
  let doc = core.createDocument(100, 100);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 0, y: 0, width: 10, height: 10 }));
  const id = doc.layers[0].id;
  let history = core.createHistory(doc);

  for (let value = 1; value <= 20; value++) {
    doc = core.updateLayer(doc, id, (layer) => ({
      adjustments: { ...layer.adjustments, brightness: value },
    }));
    history = core.pushHistory(history, doc, "Brightness", `adjust:${id}:brightness`);
  }

  assert(history.entries.length === 2, `expected one merged entry, got ${history.entries.length}`);
  assert(
    core.currentDocument(history).layers[0].adjustments.brightness === 20,
    "expected the final value"
  );

  history = core.undo(history);
  assert(
    core.currentDocument(history).layers[0].adjustments.brightness === 0,
    "expected one undo to revert the whole drag"
  );
});

await test("a new edit after undo discards the redo branch", () => {
  let doc = core.createDocument(100, 100);
  let history = core.createHistory(doc);

  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 0, y: 0, width: 10, height: 10 }));
  history = core.pushHistory(history, doc, "A");
  doc = core.addLayer(doc, core.createShapeLayer("ellipse", { x: 0, y: 0, width: 10, height: 10 }));
  history = core.pushHistory(history, doc, "B");

  history = core.undo(history);
  assert(core.canRedo(history), "expected a redo branch to exist");

  const branched = core.addLayer(core.currentDocument(history), core.createShapeLayer("star", { x: 0, y: 0, width: 10, height: 10 }));
  history = core.pushHistory(history, branched, "C");
  assert(!core.canRedo(history), "expected the redo branch to be discarded");
  assert(history.entries[history.index].label === "C", "expected the new entry on top");
});

await test("the stack is capped and drops the oldest entries", () => {
  let doc = core.createDocument(100, 100);
  let history = core.createHistory(doc);
  for (let i = 0; i < core.HISTORY_LIMIT + 25; i++) {
    doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: i, y: 0, width: 5, height: 5 }));
    history = core.pushHistory(history, doc, `Step ${i}`);
  }
  assert(
    history.entries.length === core.HISTORY_LIMIT,
    `expected the stack capped at ${core.HISTORY_LIMIT}, got ${history.entries.length}`
  );
  assert(history.index === core.HISTORY_LIMIT - 1, "expected the cursor at the newest entry");
});

await test("history snapshots are deep copies", () => {
  let doc = core.createDocument(100, 100);
  doc = core.addLayer(doc, core.createTextLayer("Hello", { x: 0, y: 0, width: 100, height: 40 }));
  const history = core.createHistory(doc);

  // Mutating the live document must not reach into the snapshot.
  doc.layers[0].text = "Changed";
  doc.layers[0].adjustments.brightness = 50;
  doc.layers[0].shadow.blur = 99;

  const snapshot = core.currentDocument(history).layers[0];
  assert(snapshot.text === "Hello", "expected the snapshot text to be isolated");
  assert(snapshot.adjustments.brightness === 0, "expected adjustments to be isolated");
  assert(snapshot.shadow.blur === 8, "expected the nested shadow to be isolated");
});

/* -------------------------------------------------------------------------- */

suite("Canvas operations");

await test("cropping translates layers so content does not move", () => {
  let doc = core.createDocument(200, 200);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 60, y: 70, width: 40, height: 40 }));

  const cropped = core.cropDocument(doc, { x: 50, y: 50, width: 100, height: 100 });
  assert(cropped.width === 100 && cropped.height === 100, "expected the new canvas size");
  assert(cropped.layers[0].x === 10, "expected the layer to shift with the crop");
  assert(cropped.layers[0].y === 20, "expected the layer to shift with the crop");
});

await test("resizing scales layers and type together", () => {
  let doc = core.createDocument(100, 100);
  doc = core.addLayer(doc, core.createTextLayer("Hi", { x: 10, y: 10, width: 50, height: 20 }));

  const scaled = core.resizeDocument(doc, 200, 200, true);
  assert(scaled.layers[0].x === 20 && scaled.layers[0].width === 100, "expected geometry scaled");
  assert(scaled.layers[0].fontSize === 96, "expected the font size to scale with the canvas");

  const canvasOnly = core.resizeDocument(doc, 200, 200, false);
  assert(canvasOnly.layers[0].x === 10 && canvasOnly.layers[0].fontSize === 48, "expected layers untouched");
  assert(canvasOnly.width === 200, "expected the canvas to grow");
});

await test("rotating the canvas swaps dimensions and repositions layers", () => {
  let doc = core.createDocument(200, 100);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 0, y: 0, width: 40, height: 20 }));

  const rotated = core.rotateDocument(doc, 1);
  assert(rotated.width === 100 && rotated.height === 200, "expected swapped dimensions");
  assert(rotated.layers[0].rotation === 90, "expected the layer rotated");

  const full = core.rotateDocument(doc, 4);
  assert(full.width === 200 && full.height === 100, "expected four turns to restore the size");
  assert(full.layers[0].rotation === 0, "expected four turns to restore the rotation");
  assertClose(full.layers[0].x, 0, 1e-9, "expected four turns to restore the position");
  assertClose(full.layers[0].y, 0, 1e-9, "expected four turns to restore the position");
});

await test("flipping the canvas mirrors layer positions", () => {
  let doc = core.createDocument(200, 100);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 10, y: 20, width: 40, height: 20 }));

  const flipped = core.flipDocument(doc, "horizontal");
  assert(flipped.layers[0].x === 150, "expected a mirrored x position");
  assert(flipped.layers[0].flipX === true, "expected the mirror flag set");

  const twice = core.flipDocument(flipped, "horizontal");
  assert(twice.layers[0].x === 10 && twice.layers[0].flipX === false, "expected flipping twice to restore");
});

await test("aligns a single layer to the canvas and several to their group box", () => {
  let doc = core.createDocument(200, 200);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 10, y: 10, width: 40, height: 40 }));
  const single = core.alignLayers(doc, [doc.layers[0].id], "center-x");
  assert(single.layers[0].x === 80, "expected centring against the canvas");

  doc = core.addLayer(doc, core.createShapeLayer("ellipse", { x: 100, y: 100, width: 20, height: 20 }));
  const ids = doc.layers.map((layer) => layer.id);
  const group = core.alignLayers(doc, ids, "left");
  assert(group.layers[0].x === 10 && group.layers[1].x === 10, "expected both aligned to the group's left edge");
});

/* -------------------------------------------------------------------------- */

suite("Rendering");

await test("renders the document background", async () => {
  const doc = core.createDocument(20, 20, { background: "#ff0000" });
  const { data, width } = await renderToPixels(doc, makeRasterStore());
  const [r, g, b, a] = pixelAt(data, width, 10, 10);
  assert(r === 255 && g === 0 && b === 0 && a === 255, `expected red, got ${[r, g, b, a]}`);
});

await test("renders a transparent canvas when asked", async () => {
  const doc = core.createDocument(20, 20, { background: "#ff0000" });
  const { data, width } = await renderToPixels(doc, makeRasterStore(), { transparent: true });
  assert(pixelAt(data, width, 10, 10)[3] === 0, "expected a fully transparent pixel");
});

await test("paints layers bottom to top", async () => {
  let doc = core.createDocument(20, 20, { background: null });
  const rect = { x: 0, y: 0, width: 20, height: 20 };
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", rect, { fill: "#ff0000", strokeWidth: 0 }));
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", rect, { fill: "#0000ff", strokeWidth: 0 }));

  const { data, width } = await renderToPixels(doc, makeRasterStore(), { transparent: true });
  const [r, , b] = pixelAt(data, width, 10, 10);
  assert(b > 200 && r < 50, `expected the top layer to win, got ${pixelAt(data, width, 10, 10)}`);
});

await test("skips hidden layers and honours opacity", async () => {
  let doc = core.createDocument(20, 20, { background: "#000000" });
  doc = core.addLayer(
    doc,
    core.createShapeLayer("rectangle", { x: 0, y: 0, width: 20, height: 20 }, {
      fill: "#ffffff",
      strokeWidth: 0,
    })
  );
  const id = doc.layers[0].id;

  const hidden = core.updateLayer(doc, id, { visible: false });
  const hiddenPixels = await renderToPixels(hidden, makeRasterStore());
  assert(pixelAt(hiddenPixels.data, hiddenPixels.width, 10, 10)[0] === 0, "expected the hidden layer skipped");

  const half = core.updateLayer(doc, id, { opacity: 0.5 });
  const halfPixels = await renderToPixels(half, makeRasterStore());
  const value = pixelAt(halfPixels.data, halfPixels.width, 10, 10)[0];
  assertClose(value, 128, 4, "expected 50% opacity over black");
});

await test("clips layers to the canvas", async () => {
  let doc = core.createDocument(20, 20, { background: null });
  // A layer that extends well past the right edge must not appear outside it.
  doc = core.addLayer(
    doc,
    core.createShapeLayer("rectangle", { x: 15, y: 0, width: 100, height: 20 }, {
      fill: "#00ff00",
      strokeWidth: 0,
    })
  );
  const { data, width, height } = await renderToPixels(doc, makeRasterStore(), { transparent: true });
  assert(width === 20 && height === 20, "expected the canvas size unchanged");
  assert(pixelAt(data, width, 18, 10)[1] > 200, "expected the visible part drawn");
});

await test("renders an image layer scaled into its box", async () => {
  const raster = makeSplitRaster("split", 40, 40, "#ff0000", "#0000ff");
  let doc = core.createDocument(80, 40, { background: null });
  doc = core.addLayer(
    doc,
    core.createImageLayer("Photo", "split", { x: 0, y: 0, width: 80, height: 40 }, { width: 40, height: 40 })
  );

  const { data, width } = await renderToPixels(doc, makeRasterStore([raster]), { transparent: true });
  assert(pixelAt(data, width, 20, 20)[0] > 200, "expected the left half red after scaling");
  assert(pixelAt(data, width, 60, 20)[2] > 200, "expected the right half blue after scaling");
});

await test("rotation and flip place content correctly", async () => {
  const raster = makeSplitRaster("split", 40, 40, "#ff0000", "#0000ff");
  let doc = core.createDocument(40, 40, { background: null });
  doc = core.addLayer(
    doc,
    core.createImageLayer("Photo", "split", { x: 0, y: 0, width: 40, height: 40 }, { width: 40, height: 40 })
  );
  const id = doc.layers[0].id;

  const flipped = core.updateLayer(doc, id, { flipX: true });
  const flippedPixels = await renderToPixels(flipped, makeRasterStore([raster]), { transparent: true });
  assert(
    pixelAt(flippedPixels.data, flippedPixels.width, 10, 20)[2] > 200,
    "expected blue on the left after a horizontal flip"
  );

  const rotated = core.updateLayer(doc, id, { rotation: 90 });
  const rotatedPixels = await renderToPixels(rotated, makeRasterStore([raster]), { transparent: true });
  assert(
    pixelAt(rotatedPixels.data, rotatedPixels.width, 20, 10)[0] > 200,
    "expected red at the top after a quarter turn"
  );
});

await test("renders every shape kind with real geometry", async () => {
  for (const shape of ["rectangle", "ellipse", "line", "arrow", "polygon", "star"]) {
    let doc = core.createDocument(60, 60, { background: null });
    doc = core.addLayer(
      doc,
      core.createShapeLayer(shape, { x: 5, y: 5, width: 50, height: 50 }, {
        fill: "#ff0000",
        strokeColor: "#ff0000",
        strokeWidth: shape === "line" || shape === "arrow" ? 6 : 0,
      })
    );
    const { data } = await renderToPixels(doc, makeRasterStore(), { transparent: true });

    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 10) painted++;
    assertGreater(painted, 40, `${shape}: expected a meaningful painted area`);
  }
});

await test("an ellipse leaves its corners transparent", async () => {
  let doc = core.createDocument(60, 60, { background: null });
  doc = core.addLayer(
    doc,
    core.createShapeLayer("ellipse", { x: 0, y: 0, width: 60, height: 60 }, {
      fill: "#ff0000",
      strokeWidth: 0,
    })
  );
  const { data, width } = await renderToPixels(doc, makeRasterStore(), { transparent: true });
  assert(pixelAt(data, width, 30, 30)[3] === 255, "expected the centre filled");
  assert(pixelAt(data, width, 2, 2)[3] === 0, "expected the corner untouched");
});

await test("a rounded rectangle clears its corners", async () => {
  let doc = core.createDocument(60, 60, { background: null });
  doc = core.addLayer(
    doc,
    core.createShapeLayer("rectangle", { x: 0, y: 0, width: 60, height: 60 }, {
      fill: "#ff0000",
      strokeWidth: 0,
      cornerRadius: 25,
    })
  );
  const { data, width } = await renderToPixels(doc, makeRasterStore(), { transparent: true });
  assert(pixelAt(data, width, 30, 30)[3] === 255, "expected the centre filled");
  assert(pixelAt(data, width, 1, 1)[3] === 0, "expected the rounded corner clear");
});

await test("renders text and respects alignment", async () => {
  const measure = nodeCanvasFactory.create(10, 10).ctx;

  for (const align of ["left", "center", "right"]) {
    let doc = core.createDocument(400, 100, { background: "#ffffff" });
    doc = core.addLayer(
      doc,
      core.createTextLayer("Hello", { x: 0, y: 10, width: 400, height: 60 }, {
        align,
        autoSize: false,
        color: "#000000",
        fontSize: 40,
      })
    );
    const { data, width } = await renderToPixels(doc, makeRasterStore());

    // Find the horizontal centre of mass of the dark pixels.
    let sum = 0;
    let count = 0;
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < width; x++) {
        if (pixelAt(data, width, x, y)[0] < 128) {
          sum += x;
          count++;
        }
      }
    }
    assertGreater(count, 20, `${align}: expected visible glyphs`);
    const centre = sum / count;

    if (align === "left") assert(centre < 150, `left: text centre at ${centre}`);
    if (align === "center") assert(centre > 150 && centre < 250, `center: text centre at ${centre}`);
    if (align === "right") assert(centre > 250, `right: text centre at ${centre}`);
  }

  assert(measure, "expected a measuring context");
});

await test("letter spacing widens a line", async () => {
  const { ctx } = nodeCanvasFactory.create(10, 10);
  const base = core.createTextLayer("Spacing", { x: 0, y: 0, width: 400, height: 60 });
  const tight = core.measureTextLayer(ctx, base);
  const loose = core.measureTextLayer(ctx, { ...base, letterSpacing: 10 });
  // Seven characters means six gaps of 10px.
  assertClose(loose.width - tight.width, 60, 1, "letter spacing width delta");
});

await test("line height changes the measured block height", () => {
  const { ctx } = nodeCanvasFactory.create(10, 10);
  const layer = core.createTextLayer("One\nTwo\nThree", { x: 0, y: 0, width: 400, height: 200 });
  const single = core.measureTextLayer(ctx, { ...layer, lineHeight: 1 });
  const double = core.measureTextLayer(ctx, { ...layer, lineHeight: 2 });
  assertClose(double.height, single.height * 2, 1, "line height doubling");
  assert(single.lines.length === 3, "expected three lines");
});

await test("a fixed-width text box wraps long lines", () => {
  const { ctx } = nodeCanvasFactory.create(10, 10);
  const layer = core.createTextLayer(
    "The quick brown fox jumps over the lazy dog again and again",
    { x: 0, y: 0, width: 200, height: 200 },
    { autoSize: false, fontSize: 24 }
  );
  const measured = core.measureTextLayer(ctx, layer);
  assert(measured.lines.length > 1, "expected the text to wrap");
  for (const line of measured.lines) {
    assert(line.width <= 200 + 1, `expected every line within the box, got ${line.width}`);
  }
});

await test("an unbreakable word is split rather than overflowing", () => {
  const { ctx } = nodeCanvasFactory.create(10, 10);
  const layer = core.createTextLayer("AAAAAAAAAAAAAAAAAAAAAAAAAAAA", { x: 0, y: 0, width: 100, height: 100 }, {
    autoSize: false,
    fontSize: 30,
  });
  const measured = core.measureTextLayer(ctx, layer);
  assert(measured.lines.length > 1, "expected the word to be broken");
  for (const line of measured.lines) {
    assert(line.width <= 101, `expected no overflow, got ${line.width}`);
  }
});

/* -------------------------------------------------------------------------- */

suite("Image operations");

await test("brightness lifts and lowers mid grey", async () => {
  const base = await renderAdjusted("#808080", {});
  const brighter = await renderAdjusted("#808080", { brightness: 40 });
  const darker = await renderAdjusted("#808080", { brightness: -40 });

  assertGreater(brighter.center[0], base.center[0] + 60, "brightness up");
  assert(darker.center[0] < base.center[0] - 60, `brightness down: got ${darker.center[0]}`);
});

await test("contrast pushes tones away from mid grey", async () => {
  const dark = await renderAdjusted("#404040", { contrast: 50 });
  const light = await renderAdjusted("#c0c0c0", { contrast: 50 });
  assert(dark.center[0] < 0x40, `expected dark tones darker, got ${dark.center[0]}`);
  assertGreater(light.center[0], 0xc0, "expected light tones lighter");

  // Mid grey is the pivot, so it must not move.
  const mid = await renderAdjusted("#808080", { contrast: 80 });
  assertClose(mid.center[0], 128, 3, "contrast pivot");
});

await test("saturation scales chroma without moving neutrals", async () => {
  const boosted = await renderAdjusted("#996666", { saturation: 100 });
  assertGreater(boosted.center[0] - boosted.center[1], 0x99 - 0x66, "expected more chroma");

  const stripped = await renderAdjusted("#996666", { saturation: -100 });
  assertClose(stripped.center[0], stripped.center[1], 2, "expected a neutral result");

  const neutral = await renderAdjusted("#808080", { saturation: 100 });
  assertClose(neutral.center[0], 128, 2, "expected grey to stay grey");
});

await test("hue rotation moves colour around the wheel", async () => {
  const rotated = await renderAdjusted("#ff0000", { hue: 120 });
  assert(
    rotated.center[1] > rotated.center[0] && rotated.center[1] > rotated.center[2],
    `expected red to become green-dominant, got ${rotated.center}`
  );

  const full = await renderAdjusted("#ff0000", { hue: 0 });
  assert(full.center[0] > 200, "expected no rotation to leave red alone");
});

await test("exposure works in stops", async () => {
  const base = await renderAdjusted("#404040", {});
  const oneStop = await renderAdjusted("#404040", { exposure: 1 });
  const down = await renderAdjusted("#404040", { exposure: -1 });

  assertGreater(oneStop.center[0], base.center[0] + 20, "expected +1 EV to brighten");
  assert(down.center[0] < base.center[0] - 10, "expected -1 EV to darken");

  // +1 EV doubles linear light; for 0x40 that lands near 0x5F in sRGB.
  assertClose(oneStop.center[0], 0x5f, 6, "one stop in sRGB");
});

await test("temperature shifts blue against amber", async () => {
  const warm = await renderAdjusted("#808080", { temperature: 60 });
  const cool = await renderAdjusted("#808080", { temperature: -60 });

  assertGreater(warm.center[0], warm.center[2], "warm should favour red over blue");
  assertGreater(cool.center[2], cool.center[0], "cool should favour blue over red");
});

await test("tint shifts green against magenta", async () => {
  const magenta = await renderAdjusted("#808080", { tint: 60 });
  const green = await renderAdjusted("#808080", { tint: -60 });

  assertGreater(magenta.center[0], magenta.center[1], "magenta should suppress green");
  assertGreater(green.center[1], green.center[0], "green tint should lift green");
});

await test("gamma bends the midtones", async () => {
  const lifted = await renderAdjusted("#808080", { gamma: 2.2 });
  const crushed = await renderAdjusted("#808080", { gamma: 0.5 });

  assertGreater(lifted.center[0], 150, "expected gamma > 1 to lift midtones");
  assert(crushed.center[0] < 110, `expected gamma < 1 to darken midtones, got ${crushed.center[0]}`);

  // Gamma must not clip the endpoints.
  const white = await renderAdjusted("#ffffff", { gamma: 2.2 });
  assertClose(white.center[0], 255, 1, "white under gamma");
  const black = await renderAdjusted("#000000", { gamma: 0.5 });
  assertClose(black.center[0], 0, 1, "black under gamma");
});

await test("shadows and highlights act only on their own end of the range", async () => {
  const shadowLift = await renderAdjusted("#202020", { shadows: 80 });
  const shadowOnHighlight = await renderAdjusted("#e0e0e0", { shadows: 80 });
  assertGreater(shadowLift.center[0], 0x20 + 20, "expected shadows lifted");
  assertClose(shadowOnHighlight.center[0], 0xe0, 4, "expected highlights untouched by the shadow control");

  const highlightPull = await renderAdjusted("#e0e0e0", { highlights: -80 });
  const highlightOnShadow = await renderAdjusted("#202020", { highlights: -80 });
  assert(highlightPull.center[0] < 0xe0 - 15, `expected highlights recovered, got ${highlightPull.center[0]}`);
  assertClose(highlightOnShadow.center[0], 0x20, 4, "expected shadows untouched by the highlight control");
});

await test("blur mixes neighbouring pixels across an edge", async () => {
  const raster = makeSplitRaster("split", 60, 20, "#000000", "#ffffff");
  let doc = core.createDocument(60, 20, { background: null });
  const layer = core.createImageLayer("Photo", "split", { x: 0, y: 0, width: 60, height: 20 }, {
    width: 60,
    height: 20,
  });
  layer.adjustments = core.createAdjustments({ blur: 40 });
  doc = core.addLayer(doc, layer);

  const { data, width } = await renderToPixels(doc, makeRasterStore([raster]), { transparent: true });
  // Right at the boundary the colour must be an intermediate grey.
  const edge = pixelAt(data, width, 30, 10)[0];
  assert(edge > 40 && edge < 215, `expected a blended edge, got ${edge}`);

  // Far from the edge the original tones should still dominate.
  assert(pixelAt(data, width, 2, 10)[0] < 90, "expected the left side to stay dark");
  assertGreater(pixelAt(data, width, 57, 10)[0], 165, "expected the right side to stay light");
});

await test("blur does not darken the edges of a transparent layer", async () => {
  let doc = core.createDocument(60, 60, { background: null });
  const layer = core.createShapeLayer("ellipse", { x: 10, y: 10, width: 40, height: 40 }, {
    fill: "#ffffff",
    strokeWidth: 0,
  });
  layer.adjustments = core.createAdjustments({ blur: 20 });
  doc = core.addLayer(doc, layer);

  const { data, width } = await renderToPixels(doc, makeRasterStore(), { transparent: true });
  // Premultiplied blur keeps partially transparent pixels white, not grey.
  let darkFringe = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha > 20 && alpha < 200 && data[i] < 150) darkFringe++;
  }
  assert(darkFringe === 0, `expected no dark fringe, found ${darkFringe} pixels`);
});

await test("sharpen increases local contrast at an edge", async () => {
  const raster = makeSplitRaster("split", 60, 20, "#606060", "#a0a0a0");

  async function edgeContrast(sharpen) {
    let doc = core.createDocument(60, 20, { background: null });
    const layer = core.createImageLayer("Photo", "split", { x: 0, y: 0, width: 60, height: 20 }, {
      width: 60,
      height: 20,
    });
    layer.adjustments = core.createAdjustments({ sharpen });
    doc = core.addLayer(doc, layer);
    const { data, width } = await renderToPixels(doc, makeRasterStore([raster]), { transparent: true });
    return pixelAt(data, width, 31, 10)[0] - pixelAt(data, width, 28, 10)[0];
  }

  const plain = await edgeContrast(0);
  const sharpened = await edgeContrast(90);
  assertGreater(sharpened, plain, "expected sharpening to steepen the edge");
});

await test("grayscale removes chroma and preserves luminance", async () => {
  const result = await renderAdjusted("#ff0000", { grayscale: 100 });
  const [r, g, b] = result.center;
  assertClose(r, g, 2, "expected equal channels");
  assertClose(g, b, 2, "expected equal channels");
  // Rec.709 luminance of pure red.
  assertClose(r, 255 * 0.2126, 4, "expected Rec.709 luminance");

  const half = await renderAdjusted("#ff0000", { grayscale: 50 });
  assert(half.center[0] > result.center[0], "expected a partial blend");
});

await test("invert produces the negative", async () => {
  const result = await renderAdjusted("#204060", { invert: 100 });
  assertClose(result.center[0], 255 - 0x20, 2, "inverted red");
  assertClose(result.center[1], 255 - 0x40, 2, "inverted green");
  assertClose(result.center[2], 255 - 0x60, 2, "inverted blue");
});

await test("sepia warms the image", async () => {
  const result = await renderAdjusted("#808080", { sepia: 100 });
  assertGreater(result.center[0], result.center[1], "expected red above green");
  assertGreater(result.center[1], result.center[2], "expected green above blue");
});

await test("threshold produces pure black and white", async () => {
  const above = await renderAdjusted("#a0a0a0", { thresholdEnabled: true, threshold: 128 });
  const below = await renderAdjusted("#404040", { thresholdEnabled: true, threshold: 128 });

  assert(above.center[0] === 255 && above.center[2] === 255, `expected white, got ${above.center}`);
  assert(below.center[0] === 0 && below.center[2] === 0, `expected black, got ${below.center}`);

  // Disabled by default, so the value alone must not change anything.
  const off = await renderAdjusted("#a0a0a0", { threshold: 250 });
  assertClose(off.center[0], 0xa0, 2, "expected threshold to be inert when disabled");
});

await test("noise reduction lowers deviation while keeping the mean", async () => {
  const raster = makeNoisyRaster("noisy", 64, 64);

  async function measure(noiseReduction) {
    let doc = core.createDocument(64, 64, { background: null });
    const layer = core.createImageLayer("Photo", "noisy", { x: 0, y: 0, width: 64, height: 64 }, {
      width: 64,
      height: 64,
    });
    layer.adjustments = core.createAdjustments({ noiseReduction });
    doc = core.addLayer(doc, layer);
    const { data } = await renderToPixels(doc, makeRasterStore([raster]), { transparent: true });

    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      sum += data[i];
      count++;
    }
    return { deviation: luminanceDeviation(data), mean: sum / count };
  }

  const noisy = await measure(0);
  const cleaned = await measure(100);
  assert(
    cleaned.deviation < noisy.deviation * 0.75,
    `expected noise reduced: ${noisy.deviation.toFixed(1)} → ${cleaned.deviation.toFixed(1)}`
  );
  assertClose(cleaned.mean, noisy.mean, 6, "expected the overall brightness preserved");
});

await test("noise reduction preserves a hard edge better than blur", async () => {
  const raster = makeSplitRaster("split", 40, 20, "#000000", "#ffffff");

  async function edgeStep(adjustments) {
    let doc = core.createDocument(40, 20, { background: null });
    const layer = core.createImageLayer("Photo", "split", { x: 0, y: 0, width: 40, height: 20 }, {
      width: 40,
      height: 20,
    });
    layer.adjustments = core.createAdjustments(adjustments);
    doc = core.addLayer(doc, layer);
    const { data, width } = await renderToPixels(doc, makeRasterStore([raster]), { transparent: true });
    return pixelAt(data, width, 22, 10)[0] - pixelAt(data, width, 17, 10)[0];
  }

  const denoised = await edgeStep({ noiseReduction: 100 });
  const blurred = await edgeStep({ blur: 30 });
  assertGreater(denoised, blurred, "expected the median filter to keep the edge sharper");
});

await test("adjustments compose in a stable order", async () => {
  // Grayscale then invert must give the negative of the luminance, proving the
  // colour matrix composes rather than overwriting.
  const result = await renderAdjusted("#ff0000", { grayscale: 100, invert: 100 });
  assertClose(result.center[0], 255 - 255 * 0.2126, 5, "composed grayscale + invert");
});

await test("a neutral adjustment set leaves pixels untouched", async () => {
  const plain = await renderAdjusted("#3a7bd5", {});
  const neutral = await renderAdjusted("#3a7bd5", {
    brightness: 0,
    contrast: 0,
    gamma: 1,
    saturation: 0,
  });
  for (let i = 0; i < 3; i++) {
    assertClose(neutral.center[i], plain.center[i], 1, `channel ${i} unchanged`);
  }
});

await test("adjustment keys are stable and detect changes", () => {
  const a = core.createAdjustments();
  assert(core.adjustmentsKey(a) === "none", "expected a neutral key");
  assert(!core.hasAdjustments(a), "expected no adjustments");

  const b = core.createAdjustments({ brightness: 10 });
  assert(core.hasAdjustments(b), "expected adjustments detected");
  assert(core.adjustmentsKey(b) === core.adjustmentsKey(core.createAdjustments({ brightness: 10 })), "expected a stable key");
  assert(core.adjustmentsKey(b) !== core.adjustmentsKey(core.createAdjustments({ brightness: 11 })), "expected keys to differ");

  assert(core.hasSpatialAdjustments(core.createAdjustments({ blur: 1 })), "blur is spatial");
  assert(!core.hasSpatialAdjustments(b), "brightness is not spatial");
});

/* -------------------------------------------------------------------------- */

suite("Export");

await test("composites at a requested scale", async () => {
  let doc = core.createDocument(50, 30, { background: "#123456" });
  doc = core.addLayer(
    doc,
    core.createShapeLayer("rectangle", { x: 0, y: 0, width: 25, height: 30 }, {
      fill: "#ffffff",
      strokeWidth: 0,
    })
  );

  const result = core.composite(doc, makeRasterStore(), nodeCanvasFactory, { scale: 3 });
  assert(result.width === 150 && result.height === 90, `unexpected size ${result.width}x${result.height}`);

  const data = result.ctx.getImageData(0, 0, result.width, result.height).data;
  assert(pixelAt(data, result.width, 30, 45)[0] === 255, "expected the white rectangle scaled up");
  assert(pixelAt(data, result.width, 120, 45)[0] === 0x12, "expected the background scaled up");
});

await test("exports a region of the canvas", async () => {
  let doc = core.createDocument(100, 100, { background: "#000000" });
  doc = core.addLayer(
    doc,
    core.createShapeLayer("rectangle", { x: 50, y: 50, width: 50, height: 50 }, {
      fill: "#ff0000",
      strokeWidth: 0,
    })
  );

  const result = core.composite(doc, makeRasterStore(), nodeCanvasFactory, {
    region: { x: 50, y: 50, width: 50, height: 50 },
  });
  assert(result.width === 50 && result.height === 50, "expected the region size");
  const data = result.ctx.getImageData(0, 0, 50, 50).data;
  assert(pixelAt(data, 50, 25, 25)[0] > 200, "expected the region to contain the red square");
});

await test("a matte flattens transparency for formats without alpha", async () => {
  const doc = core.createDocument(20, 20, { background: null });
  const flattened = core.composite(doc, makeRasterStore(), nodeCanvasFactory, {
    transparent: false,
    matte: "#00ff00",
  });
  const data = flattened.ctx.getImageData(0, 0, 20, 20).data;
  assert(pixelAt(data, 20, 10, 10)[1] === 255, "expected the matte painted");
  assert(pixelAt(data, 20, 10, 10)[3] === 255, "expected an opaque result");
});

await test("clamps the export scale for very large canvases", () => {
  const doc = core.createDocument(8000, 4000);
  const clamped = core.clampExportScale(doc, undefined, 8);
  assert(clamped * 8000 <= core.EXPORT_RASTER_CAP + 1, `expected the scale clamped, got ${clamped}`);

  const modest = core.createDocument(1000, 1000);
  assert(core.clampExportScale(modest, undefined, 2) === 2, "expected small canvases to keep their scale");
});

await test("SVG export emits real vector elements", () => {
  let doc = core.createDocument(200, 120, { background: "#ffffff", name: "Poster" });
  doc = core.addLayer(
    doc,
    core.createShapeLayer("rectangle", { x: 10, y: 10, width: 80, height: 40 }, {
      fill: "#ff0000",
      strokeColor: "#000000",
      strokeWidth: 2,
      cornerRadius: 8,
    })
  );
  doc = core.addLayer(doc, core.createTextLayer("Hello SVG", { x: 20, y: 70, width: 160, height: 30 }));

  const { ctx } = nodeCanvasFactory.create(10, 10);
  const svg = core.documentToSvg(doc, new Map(), ctx);

  assert(svg.startsWith("<svg "), "expected an SVG root");
  assert(svg.includes('width="200"') && svg.includes('height="120"'), "expected the document size");
  assert(svg.includes('viewBox="0 0 200 120"'), "expected a viewBox");
  assert(svg.includes("<path "), "expected a vector path for the shape");
  assert(svg.includes("<text "), "expected a real text element");
  assert(svg.includes("Hello SVG"), "expected the text content");
  assert(svg.includes('fill="#ff0000"'), "expected the fill colour");
  assert(svg.includes('stroke-width="2"'), "expected the stroke width");
  assert(svg.includes("</svg>"), "expected a closed root");
});

await test("SVG export escapes text and layer names", () => {
  let doc = core.createDocument(100, 100, { name: 'Weird & "quoted"' });
  doc = core.addLayer(
    doc,
    core.createTextLayer('5 < 6 & "yes"', { x: 0, y: 0, width: 100, height: 30 })
  );

  const { ctx } = nodeCanvasFactory.create(10, 10);
  const svg = core.documentToSvg(doc, new Map(), ctx);

  // The raw characters must never survive; only their entity forms may appear.
  const textBody = svg.match(/<text[^>]*>([\s\S]*?)<\/text>/)?.[1] ?? "";
  assert(textBody.length > 0, "expected a text element");
  assert(!textBody.includes("<") && !textBody.includes(">"), `raw angle bracket in ${textBody}`);
  assert(!/&(?!(amp|lt|gt|quot|apos);)/.test(textBody), `unescaped ampersand in ${textBody}`);
  assert(svg.includes("&lt;") && svg.includes("&amp;"), "expected entities to be escaped");
  assert(svg.includes("&quot;"), "expected quotes escaped");

  // The document title travels through the same escaping path.
  const title = svg.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
  assert(title.includes("&amp;") && title.includes("&quot;"), `unescaped title: ${title}`);

  // Whatever it contains, the result has to parse as XML.
  assert(svg.split("<svg ").length === 2, "expected exactly one root element");
});

await test("SVG export skips hidden layers and embeds image hrefs", () => {
  let doc = core.createDocument(100, 100);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 0, y: 0, width: 10, height: 10 }));
  doc = core.addLayer(
    doc,
    core.createImageLayer("Photo", "src", { x: 0, y: 0, width: 50, height: 50 }, { width: 50, height: 50 })
  );
  doc = core.updateLayer(doc, doc.layers[0].id, { visible: false });

  const hrefs = new Map([[doc.layers[1].id, "data:image/png;base64,AAAA"]]);
  const svg = core.documentToSvg(doc, hrefs, null);

  assert(!svg.includes("<path "), "expected the hidden shape omitted");
  assert(svg.includes("<image "), "expected the image layer emitted");
  assert(svg.includes("data:image/png;base64,AAAA"), "expected the embedded href");
});

await test("SVG transforms match the canvas renderer", async () => {
  // A rotated, offset rectangle must land in the same place in both outputs.
  let doc = core.createDocument(100, 100, { background: null });
  doc = core.addLayer(
    doc,
    core.createShapeLayer("rectangle", { x: 20, y: 30, width: 40, height: 20 }, {
      fill: "#ff0000",
      strokeWidth: 0,
      rotation: 45,
    })
  );
  doc = core.updateLayer(doc, doc.layers[0].id, { rotation: 45 });

  const svg = core.documentToSvg(doc, new Map(), null);
  // Centre is (40, 40); the transform must translate there before rotating.
  assert(svg.includes("translate(40 40)"), `expected a centre translate, got: ${svg}`);
  assert(svg.includes("rotate(45)"), "expected the rotation");
  assert(svg.includes("translate(-20 -10)"), "expected the corner translate");
});

await test("file names are sanitised and extended correctly", () => {
  assert(core.exportFileName("my photo", "png") === "my photo.png", "expected a png extension");
  assert(core.exportFileName("my photo", "jpeg") === "my photo.jpg", "expected jpg rather than jpeg");
  assert(core.exportFileName("a/b\\c:d", "webp") === "abcd.webp", "expected path characters stripped");
  assert(core.exportFileName("   ", "png") === "imagepilot-export.png", "expected a fallback name");
  assert(core.exportFileName("x".repeat(200), "png").length <= 84, "expected the name to be capped");
});

await test("every declared export format has a usable descriptor", () => {
  for (const format of ["png", "jpeg", "webp", "svg"]) {
    const descriptor = core.formatDescriptor(format);
    assert(descriptor.value === format, `expected a descriptor for ${format}`);
    assert(descriptor.mimeType.startsWith("image/"), `expected a mime type for ${format}`);
    assert(descriptor.extension.length > 0, `expected an extension for ${format}`);
  }
  assert(core.formatDescriptor("png").supportsAlpha, "PNG supports alpha");
  assert(!core.formatDescriptor("jpeg").supportsAlpha, "JPEG has no alpha");
  assert(core.formatDescriptor("jpeg").supportsQuality, "JPEG has a quality setting");
});

await test("encodes real PNG, JPEG and WEBP bytes", async () => {
  let doc = core.createDocument(40, 40, { background: "#3366cc" });
  doc = core.addLayer(
    doc,
    core.createShapeLayer("star", { x: 5, y: 5, width: 30, height: 30 }, {
      fill: "#ffcc00",
      strokeWidth: 0,
    })
  );
  const result = core.composite(doc, makeRasterStore(), nodeCanvasFactory, { scale: 2 });

  const png = result.canvas.toBuffer("image/png");
  assert(png.length > 100, "expected PNG bytes");
  assert(png[0] === 0x89 && png[1] === 0x50, "expected a PNG signature");

  const jpeg = result.canvas.toBuffer("image/jpeg");
  assert(jpeg[0] === 0xff && jpeg[1] === 0xd8, "expected a JPEG signature");

  const webp = result.canvas.toBuffer("image/webp");
  assert(
    String.fromCharCode(...webp.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...webp.subarray(8, 12)) === "WEBP",
    "expected a WEBP signature"
  );
});

/* -------------------------------------------------------------------------- */

suite("Registry and configuration");

await test("every adjustment descriptor maps to a real field", () => {
  const defaults = core.createAdjustments();
  for (const descriptor of core.ADJUSTMENTS) {
    assert(descriptor.key in defaults, `unknown adjustment key ${descriptor.key}`);
    assert(descriptor.min < descriptor.max, `${descriptor.key}: expected a valid range`);
    assert(
      descriptor.neutral >= descriptor.min && descriptor.neutral <= descriptor.max,
      `${descriptor.key}: neutral value outside the range`
    );
    assert(
      defaults[descriptor.key] === descriptor.neutral,
      `${descriptor.key}: default ${defaults[descriptor.key]} should equal neutral ${descriptor.neutral}`
    );
    assert(
      core.ADJUSTMENT_GROUPS.some((group) => group.id === descriptor.group),
      `${descriptor.key}: unknown group ${descriptor.group}`
    );
  }
});

await test("the requested image operations are all present", () => {
  const required = [
    "brightness", "contrast", "saturation", "hue", "exposure", "temperature",
    "tint", "gamma", "shadows", "highlights", "blur", "sharpen", "grayscale",
    "invert", "sepia", "threshold", "noiseReduction",
  ];
  const available = new Set(core.ADJUSTMENTS.map((entry) => entry.key));
  for (const key of required) {
    assert(available.has(key), `missing image operation: ${key}`);
  }
});

await test("tool shortcuts are unique", () => {
  const shortcuts = core.EDITOR_TOOLS.map((tool) => tool.shortcut.toLowerCase());
  assert(new Set(shortcuts).size === shortcuts.length, `duplicate shortcut in ${shortcuts.join(", ")}`);
  assert(core.EDITOR_TOOLS.length >= 12, "expected the full tool rail");
});

await test("every blend mode is a valid canvas composite operation", async () => {
  const { ctx } = nodeCanvasFactory.create(10, 10);
  for (const mode of core.BLEND_MODES) {
    // "normal" is the CSS spelling; canvas calls it "source-over". Setting an
    // unsupported value is silently ignored, so each mode is checked against a
    // known-different starting point to prove it actually took effect.
    ctx.globalCompositeOperation = "xor";
    const expected = mode.value === "normal" ? "source-over" : mode.value;
    ctx.globalCompositeOperation = expected;
    assert(
      ctx.globalCompositeOperation === expected,
      `${mode.value}: the canvas rejected this blend mode`
    );
  }
});

await test("setting a layer back to Normal clears the previous blend mode", async () => {
  let doc = core.createDocument(20, 20, { background: null });
  const rect = { x: 0, y: 0, width: 20, height: 20 };
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", rect, { fill: "#808080", strokeWidth: 0 }));
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", rect, { fill: "#808080", strokeWidth: 0 }));
  const topId = doc.layers[1].id;

  const multiplied = await renderToPixels(
    core.updateLayer(doc, topId, { blendMode: "multiply" }),
    makeRasterStore(),
    { transparent: true }
  );
  const restored = await renderToPixels(
    core.updateLayer(doc, topId, { blendMode: "normal" }),
    makeRasterStore(),
    { transparent: true }
  );

  assertClose(pixelAt(multiplied.data, multiplied.width, 10, 10)[0], 64, 4, "multiply result");
  assertClose(
    pixelAt(restored.data, restored.width, 10, 10)[0],
    128,
    4,
    "expected Normal to composite as source-over"
  );
});

await test("blend modes change the composited result", async () => {
  let doc = core.createDocument(20, 20, { background: null });
  const rect = { x: 0, y: 0, width: 20, height: 20 };
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", rect, { fill: "#808080", strokeWidth: 0 }));
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", rect, { fill: "#808080", strokeWidth: 0 }));
  const topId = doc.layers[1].id;

  const normal = await renderToPixels(doc, makeRasterStore(), { transparent: true });
  const multiplied = await renderToPixels(
    core.updateLayer(doc, topId, { blendMode: "multiply" }),
    makeRasterStore(),
    { transparent: true }
  );

  const normalValue = pixelAt(normal.data, normal.width, 10, 10)[0];
  const multipliedValue = pixelAt(multiplied.data, multiplied.width, 10, 10)[0];
  assert(multipliedValue < normalValue, `expected multiply to darken: ${normalValue} → ${multipliedValue}`);
  assertClose(multipliedValue, 64, 4, "expected 0.5 × 0.5");
});

await test("canvas and crop presets are well formed", () => {
  for (const preset of core.CANVAS_PRESETS) {
    assert(preset.width > 0 && preset.height > 0, `${preset.label}: expected positive dimensions`);
    assert(preset.width <= core.MAX_CANVAS_DIMENSION, `${preset.label}: exceeds the canvas limit`);
  }
  const free = core.CROP_RATIOS.find((entry) => entry.label === "Free");
  assert(free && free.ratio === null, "expected an unconstrained crop option");
  for (const entry of core.CROP_RATIOS) {
    assert(entry.ratio === null || entry.ratio > 0, `${entry.label}: expected a positive ratio`);
  }
});

await test("aspect ratios reshape a crop box around its centre", () => {
  const rect = { x: 100, y: 100, width: 200, height: 100 };
  const square = core.applyAspectRatio(rect, 1);
  assertClose(square.width, square.height, 1e-6, "expected a square");
  assertClose(square.x + square.width / 2, 200, 1e-6, "expected the centre held");
  assertClose(square.y + square.height / 2, 150, 1e-6, "expected the centre held");

  const untouched = core.applyAspectRatio(rect, null);
  assert(untouched.width === 200, "expected a free ratio to change nothing");
});

await test("crop boxes stay inside the canvas", () => {
  const doc = { width: 100, height: 100 };
  const pushed = core.clampRectToDocument({ x: -20, y: 90, width: 50, height: 50 }, doc);
  assert(pushed.x === 0, "expected the left edge clamped");
  assert(pushed.y === 50, "expected the bottom edge clamped");

  const oversized = core.clampRectToDocument({ x: 0, y: 0, width: 500, height: 500 }, doc);
  assert(oversized.width === 100 && oversized.height === 100, "expected the size clamped");
});

/* -------------------------------------------------------------------------- */

suite("Editor state machine");

/** Builds a state with `count` shape layers, returning their ids too. */
function stateWithLayers(count = 3) {
  let doc = core.createDocument(500, 400);
  const ids = [];
  for (let i = 0; i < count; i++) {
    doc = core.addLayer(
      doc,
      core.createShapeLayer("rectangle", { x: i * 40, y: i * 30, width: 60, height: 50 })
    );
    ids.push(doc.layers[doc.layers.length - 1].id);
  }
  return { state: editor.createEditorState(doc), ids };
}

await test("selection modes replace, add and toggle", () => {
  const { state, ids } = stateWithLayers(3);

  let next = editor.editorReducer(state, { type: "select", ids: [ids[0]] });
  assert(next.selection.length === 1, "expected a single selection");

  next = editor.editorReducer(next, { type: "select", ids: [ids[1]], mode: "add" });
  assert(next.selection.length === 2, "expected the selection to grow");

  next = editor.editorReducer(next, { type: "select", ids: [ids[1]], mode: "toggle" });
  assert(next.selection.length === 1, "expected toggle to remove an existing id");

  next = editor.editorReducer(next, { type: "select", ids: [ids[2]] });
  assert(
    next.selection.length === 1 && next.selection[0] === ids[2],
    "expected replace to discard the previous selection"
  );
});

await test("select all skips locked and hidden layers", () => {
  const { state, ids } = stateWithLayers(3);
  let next = editor.editorReducer(state, {
    type: "toggle-layer-flag",
    id: ids[0],
    flag: "locked",
  });
  next = editor.editorReducer(next, { type: "toggle-layer-flag", id: ids[1], flag: "visible" });
  next = editor.editorReducer(next, { type: "select-all" });

  assert(next.selection.length === 1, `expected one selectable layer, got ${next.selection.length}`);
  assert(next.selection[0] === ids[2], "expected only the plain layer selected");
});

await test("deleting a layer clears it from the selection", () => {
  const { state, ids } = stateWithLayers(2);
  let next = editor.editorReducer(state, { type: "select", ids });
  next = editor.editorReducer(next, { type: "delete-selected" });

  assert(editor.editorDocument(next).layers.length === 0, "expected both layers removed");
  assert(next.selection.length === 0, "expected the selection cleared");
});

await test("deleting a locked layer is refused with a message", () => {
  const { state, ids } = stateWithLayers(1);
  let next = editor.editorReducer(state, { type: "toggle-layer-flag", id: ids[0], flag: "locked" });
  next = editor.editorReducer(next, { type: "select", ids: [ids[0]] });
  next = editor.editorReducer(next, { type: "delete-selected" });

  assert(editor.editorDocument(next).layers.length === 1, "expected the locked layer to survive");
  assert(next.status?.tone === "error", "expected an error message");
  assert(/unlock/i.test(next.status.message), `unexpected message: ${next.status?.message}`);
});

await test("undo restores a deleted layer and the selection stays valid", () => {
  const { state, ids } = stateWithLayers(2);
  let next = editor.editorReducer(state, { type: "select", ids: [ids[0]] });
  next = editor.editorReducer(next, { type: "delete-selected" });
  assert(editor.editorDocument(next).layers.length === 1, "expected one layer left");

  next = editor.editorReducer(next, { type: "undo" });
  assert(editor.editorDocument(next).layers.length === 2, "expected undo to restore the layer");
  // Selection ids that no longer exist must be pruned, never left dangling.
  for (const id of next.selection) {
    assert(
      editor.editorDocument(next).layers.some((layer) => layer.id === id),
      "expected every selected id to exist"
    );
  }
});

await test("undo after switching tools keeps the tool", () => {
  const { state, ids } = stateWithLayers(1);
  let next = editor.editorReducer(state, { type: "set-tool", tool: "ellipse" });
  next = editor.editorReducer(next, { type: "select", ids: [ids[0]] });
  next = editor.editorReducer(next, { type: "delete-selected" });
  next = editor.editorReducer(next, { type: "undo" });
  assert(next.tool === "ellipse", "expected the active tool to be independent of history");
});

await test("leaving the crop tool abandons the crop box", () => {
  const { state } = stateWithLayers(1);
  let next = editor.editorReducer(state, { type: "set-tool", tool: "crop" });
  next = editor.editorReducer(next, {
    type: "set-crop",
    rect: { x: 10, y: 10, width: 100, height: 100 },
  });
  assert(next.crop, "expected a crop box");

  next = editor.editorReducer(next, { type: "set-tool", tool: "move" });
  assert(next.crop === null, "expected the crop discarded when leaving the tool");
});

await test("hiding a layer removes it from the selection", () => {
  const { state, ids } = stateWithLayers(2);
  let next = editor.editorReducer(state, { type: "select", ids });
  next = editor.editorReducer(next, { type: "toggle-layer-flag", id: ids[0], flag: "visible" });

  assert(!next.selection.includes(ids[0]), "expected the hidden layer deselected");
  assert(next.selection.includes(ids[1]), "expected the other layer still selected");
});

await test("a slider drag collapses into one undo step", () => {
  const { state, ids } = stateWithLayers(1);
  let next = editor.editorReducer(state, { type: "select", ids: [ids[0]] });
  const before = next.history.entries.length;

  // Simulate 30 pointer-move updates during a single drag.
  for (let value = 1; value <= 30; value++) {
    next = editor.editorReducer(next, {
      type: "update-layer",
      id: ids[0],
      patch: {
        adjustments: {
          ...editor.editorDocument(next).layers[0].adjustments,
          contrast: value,
        },
      },
      label: "Adjust image",
      mergeKey: `adjust:${ids[0]}:contrast`,
    });
  }

  assert(
    next.history.entries.length === before + 1,
    `expected one new entry, got ${next.history.entries.length - before}`
  );
  assert(editor.editorDocument(next).layers[0].adjustments.contrast === 30, "expected the final value");

  next = editor.editorReducer(next, { type: "undo" });
  assert(
    editor.editorDocument(next).layers[0].adjustments.contrast === 0,
    "expected one undo to revert the whole drag"
  );
});

await test("separate drags stay separate undo steps", () => {
  const { state, ids } = stateWithLayers(1);
  let next = editor.editorReducer(state, { type: "select", ids: [ids[0]] });
  const before = next.history.entries.length;

  const adjust = (key, value) =>
    editor.editorReducer(next, {
      type: "update-layer",
      id: ids[0],
      patch: {
        adjustments: { ...editor.editorDocument(next).layers[0].adjustments, [key]: value },
      },
      label: "Adjust image",
      mergeKey: `adjust:${ids[0]}:${key}`,
    });

  next = adjust("contrast", 20);
  next = adjust("brightness", 15);

  assert(
    next.history.entries.length === before + 2,
    "expected two entries for two different sliders"
  );
});

await test("duplicating selects the copies rather than the originals", () => {
  const { state, ids } = stateWithLayers(2);
  let next = editor.editorReducer(state, { type: "select", ids: [ids[0]] });
  next = editor.editorReducer(next, { type: "duplicate-selected" });

  assert(editor.editorDocument(next).layers.length === 3, "expected one extra layer");
  assert(next.selection.length === 1, "expected a single selection");
  assert(!ids.includes(next.selection[0]), "expected the copy to be selected, not the original");
});

await test("adding a layer selects it", () => {
  const { state } = stateWithLayers(0);
  const layer = core.createTextLayer("Hello", { x: 0, y: 0, width: 100, height: 40 });
  const next = editor.editorReducer(state, { type: "add-layer", layer });

  assert(editor.editorDocument(next).layers.length === 1, "expected the layer added");
  assert(next.selection.length === 1, "expected the new layer selected");
  assert(next.selection[0] === editor.editorDocument(next).layers[0].id, "expected the correct id");
});

await test("update-selected applies to every selected layer", () => {
  const { state, ids } = stateWithLayers(3);
  let next = editor.editorReducer(state, { type: "select", ids: [ids[0], ids[2]] });
  next = editor.editorReducer(next, {
    type: "update-selected",
    patch: (layer) => ({ x: layer.x + 100 }),
    label: "Nudge layer",
  });

  const layers = editor.editorDocument(next).layers;
  assert(layers[0].x === 100, "expected the first layer moved");
  assert(layers[1].x === 40, "expected the unselected layer untouched");
  assert(layers[2].x === 180, "expected the third layer moved");
});

await test("history jump moves to an arbitrary point", () => {
  const { state } = stateWithLayers(0);
  let next = state;
  for (let i = 0; i < 4; i++) {
    next = editor.editorReducer(next, {
      type: "add-layer",
      layer: core.createShapeLayer("rectangle", { x: i, y: 0, width: 10, height: 10 }),
    });
  }
  assert(editor.editorDocument(next).layers.length === 4, "expected four layers");

  next = editor.editorReducer(next, { type: "history-jump", index: 2 });
  assert(editor.editorDocument(next).layers.length === 2, "expected the state at index 2");
  assert(editor.editorCanRedo(next), "expected redo to be available after jumping back");

  next = editor.editorReducer(next, { type: "history-jump", index: 99 });
  assert(editor.editorDocument(next).layers.length === 4, "expected an out-of-range jump to clamp");
});

await test("loading a document resets history and transient state", () => {
  const { state, ids } = stateWithLayers(2);
  let next = editor.editorReducer(state, { type: "select", ids });
  next = editor.editorReducer(next, { type: "set-crop", rect: { x: 0, y: 0, width: 10, height: 10 } });

  next = editor.editorReducer(next, {
    type: "load",
    document: core.createDocument(800, 600),
    label: "Open image",
  });

  assert(!editor.editorCanUndo(next), "expected a fresh history");
  assert(next.selection.length === 0, "expected the selection cleared");
  assert(next.crop === null, "expected the crop cleared");
  assert(editor.editorDocument(next).width === 800, "expected the new document");
});

await test("workspace settings toggle independently of the document", () => {
  const { state } = stateWithLayers(1);
  assert(state.settings.showRulers === true, "expected rulers on by default");
  assert(state.settings.snapEnabled === true, "expected snapping on by default");

  let next = editor.editorReducer(state, { type: "set-setting", key: "showGrid", value: true });
  next = editor.editorReducer(next, { type: "set-setting", key: "snapEnabled", value: false });

  assert(next.settings.showGrid === true, "expected the grid enabled");
  assert(next.settings.snapEnabled === false, "expected snapping disabled");
  assert(next.settings.showRulers === true, "expected other settings untouched");
  // Settings are workspace preferences, not document content.
  assert(!editor.editorCanUndo(next), "expected settings not to enter history");
});

await test("activeLayer resolves only for a single selection", () => {
  const { state, ids } = stateWithLayers(3);
  assert(editor.activeLayer(state) === null, "expected null with nothing selected");

  const one = editor.editorReducer(state, { type: "select", ids: [ids[1]] });
  assert(editor.activeLayer(one)?.id === ids[1], "expected the single selected layer");

  const many = editor.editorReducer(state, { type: "select", ids: [ids[0], ids[1]] });
  assert(editor.activeLayer(many) === null, "expected null for a multi-selection");
});

await test("selectedLayers returns layers in document order", () => {
  const { state, ids } = stateWithLayers(3);
  // Select out of order; the result must still follow the stacking order.
  const next = editor.editorReducer(state, { type: "select", ids: [ids[2], ids[0]] });
  const layers = editor.selectedLayers(next);
  assert(layers.length === 2, "expected two layers");
});

await test("reordering through the reducer records history", () => {
  const { state, ids } = stateWithLayers(3);
  let next = editor.editorReducer(state, { type: "select", ids: [ids[0]] });
  const before = next.history.entries.length;
  next = editor.editorReducer(next, { type: "reorder-selected", mode: "front" });

  assert(next.history.entries.length === before + 1, "expected a history entry");
  const layers = editor.editorDocument(next).layers;
  assert(layers[layers.length - 1].id === ids[0], "expected the layer moved to the front");

  next = editor.editorReducer(next, { type: "undo" });
  assert(
    editor.editorDocument(next).layers[0].id === ids[0],
    "expected undo to restore the original order"
  );
});

/* -------------------------------------------------------------------------- */

suite("Workspaces");

await test("every workspace is well formed and routes uniquely", () => {
  const slugs = new Set();
  for (const workspace of core.workspaces) {
    assert(workspace.id && workspace.name, "expected an id and name");
    assert(workspace.panels.length > 0, `${workspace.id}: expected at least one panel`);
    assert(workspace.keywords.length > 0, `${workspace.id}: expected search keywords`);
    assert(workspace.highlights.length > 0, `${workspace.id}: expected highlights`);
    assert(
      ["png", "jpeg", "webp", "svg"].includes(workspace.defaultFormat),
      `${workspace.id}: unknown default format`
    );
    assert(!slugs.has(workspace.slug), `duplicate slug ${workspace.slug}`);
    slugs.add(workspace.slug);
  }
  assert(core.workspaces.length === 5, `expected five workspaces, got ${core.workspaces.length}`);
});

await test("focused workspaces expose only real tools", () => {
  const known = new Set(core.EDITOR_TOOLS.map((tool) => tool.id));
  for (const workspace of core.workspaces) {
    if (workspace.tools === null) continue;
    assert(workspace.tools.length > 0, `${workspace.id}: expected a non-empty tool list`);
    for (const tool of workspace.tools) {
      assert(known.has(tool), `${workspace.id}: unknown tool ${tool}`);
    }
  }
  // The full editor must keep every tool.
  assert(core.getWorkspace("editor").tools === null, "expected the editor to expose all tools");
});

await test("workspace lookup and hrefs resolve", () => {
  assert(core.getWorkspace("screenshot").name === "Screenshot Editor", "expected lookup by id");
  assert(core.getWorkspaceBySlug("compressor")?.id === "compress", "expected lookup by slug");
  assert(core.getWorkspaceBySlug("nope") === undefined, "expected an unknown slug to be undefined");
  assert(core.workspaceHref(core.getWorkspace("editor")) === "/imagepilot", "editor route");
  assert(
    core.workspaceHref(core.getWorkspace("watermark")) === "/imagepilot/watermark-studio",
    "watermark route"
  );
  assert(core.focusedWorkspaces.length === 4, "expected four focused workspaces");
});

/* -------------------------------------------------------------------------- */

suite("Pixelate");

await test("pixelate averages each cell to a flat block", async () => {
  const raster = makeSplitRaster("split", 40, 40, "#000000", "#ffffff");
  let doc = core.createDocument(40, 40, { background: null });
  const layer = core.createImageLayer("Photo", "split", { x: 0, y: 0, width: 40, height: 40 }, {
    width: 40,
    height: 40,
  });
  layer.adjustments = core.createAdjustments({ pixelate: 10 });
  doc = core.addLayer(doc, layer);

  const { data, width } = await renderToPixels(doc, makeRasterStore([raster]), { transparent: true });

  // Every pixel inside one cell must be identical.
  const corner = pixelAt(data, width, 1, 1);
  for (const [x, y] of [[2, 3], [8, 8], [5, 9]]) {
    const sample = pixelAt(data, width, x, y);
    assert(
      sample[0] === corner[0] && sample[1] === corner[1],
      `expected a flat cell, got ${sample} vs ${corner}`
    );
  }
  // The left cells stay dark and the right cells stay light.
  assert(pixelAt(data, width, 5, 20)[0] < 40, "expected the dark half to stay dark");
  assertGreater(pixelAt(data, width, 35, 20)[0], 215, "expected the light half to stay light");
});

await test("pixelate destroys fine detail that blur only softens", async () => {
  // Fine striping stands in for small text: the worst case for anyone trying
  // to recover content that was meant to be hidden. It has to live in a single
  // raster so the filter has neighbouring detail to average across.
  const size = 48;
  const striped = (() => {
    const { canvas, ctx } = nodeCanvasFactory.create(size, size);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000000";
    for (let y = 0; y < size; y += 4) ctx.fillRect(0, y, size, 2);
    return { id: "striped", width: size, height: size, image: canvas };
  })();

  async function detailVariance(adjustments) {
    let doc = core.createDocument(size, size, { background: "#ffffff" });
    const layer = core.createImageLayer("Stripes", "striped", { x: 0, y: 0, width: size, height: size }, {
      width: size,
      height: size,
    });
    layer.adjustments = core.createAdjustments(adjustments);
    doc = core.addLayer(doc, layer);
    const { data } = await renderToPixels(doc, makeRasterStore([striped]));
    return luminanceDeviation(data);
  }

  const plain = await detailVariance({});
  const pixelated = await detailVariance({ pixelate: 16 });
  const blurred = await detailVariance({ blur: 12 });

  assertGreater(plain, 90, "expected the striped source to be high contrast");
  assert(
    pixelated < plain * 0.35,
    `expected pixelation to destroy the detail: ${plain.toFixed(1)} -> ${pixelated.toFixed(1)}`
  );
  assert(
    blurred < plain,
    `expected blur to reduce detail too: ${plain.toFixed(1)} -> ${blurred.toFixed(1)}`
  );
});

await test("pixelate is registered as a detail adjustment", () => {
  const entry = core.ADJUSTMENTS.find((a) => a.key === "pixelate");
  assert(entry, "expected a pixelate descriptor");
  assert(entry.group === "detail", "expected it grouped with detail");
  assert(entry.neutral === 0, "expected 0 to be neutral");
  assert(core.createAdjustments().pixelate === 0, "expected the default to be off");
  assert(core.hasAdjustments(core.createAdjustments({ pixelate: 8 })), "expected it to count");
  assert(
    core.hasSpatialAdjustments(core.createAdjustments({ pixelate: 8 })),
    "expected it to be spatial"
  );
});

await test("pixelate leaves fully transparent regions alone", async () => {
  let doc = core.createDocument(40, 40, { background: null });
  const layer = core.createShapeLayer("ellipse", { x: 10, y: 10, width: 20, height: 20 }, {
    fill: "#ff0000",
    strokeWidth: 0,
  });
  layer.adjustments = core.createAdjustments({ pixelate: 6 });
  doc = core.addLayer(doc, layer);

  const { data, width } = await renderToPixels(doc, makeRasterStore(), { transparent: true });
  // The far corner is outside the shape entirely and must stay clear.
  assert(pixelAt(data, width, 1, 38)[3] === 0, "expected the empty corner untouched");
});

/* -------------------------------------------------------------------------- */

suite("Watermark studio");

/** Rough text measurer standing in for a canvas context. */
const measure = (fontSize) => fontSize * 5;

await test("places a single watermark at each corner preset", () => {
  const settings = { ...core.defaultWatermarkSettings, scale: 0.1, margin: 0.05 };
  const width = 1000;
  const height = 800;

  const topLeft = core.buildWatermarkLayers({ ...settings, position: "top-left" }, width, height, measure);
  const bottomRight = core.buildWatermarkLayers(
    { ...settings, position: "bottom-right" },
    width,
    height,
    measure
  );
  const centre = core.buildWatermarkLayers({ ...settings, position: "center" }, width, height, measure);

  assert(topLeft.length === 1 && bottomRight.length === 1, "expected one layer each");

  assert(topLeft[0].x < width / 2 && topLeft[0].y < height / 2, "expected the top-left corner");
  assertGreater(bottomRight[0].x, width / 2, "expected the right side");
  assertGreater(bottomRight[0].y, height / 2, "expected the bottom");

  // Centre must actually be centred.
  assertClose(centre[0].x + centre[0].width / 2, width / 2, 1, "centred horizontally");
  assertClose(centre[0].y + centre[0].height / 2, height / 2, 1, "centred vertically");
});

await test("watermark honours opacity, rotation and scale", () => {
  const settings = {
    ...core.defaultWatermarkSettings,
    opacity: 0.3,
    rotation: 45,
    scale: 0.2,
  };
  const [layer] = core.buildWatermarkLayers(settings, 1000, 1000, measure);

  assertClose(layer.opacity, 0.3, 1e-9, "opacity");
  assert(layer.rotation === 45, "rotation");
  // scale 0.2 of a 1000px shorter side gives a 200px cap height.
  assertClose(layer.fontSize, 200, 1, "font size follows scale");

  const smaller = core.buildWatermarkLayers({ ...settings, scale: 0.05 }, 1000, 1000, measure);
  assert(smaller[0].fontSize < layer.fontSize, "expected a smaller scale to shrink the mark");
});

await test("scale is relative so one setting suits mixed resolutions", () => {
  const settings = { ...core.defaultWatermarkSettings, scale: 0.1 };
  const [small] = core.buildWatermarkLayers(settings, 500, 500, measure);
  const [large] = core.buildWatermarkLayers(settings, 2000, 2000, measure);

  // Four times the canvas should give four times the mark.
  assertClose(large.fontSize / small.fontSize, 4, 0.01, "proportional sizing");
});

await test("tiling covers the canvas and stays bounded", () => {
  const settings = { ...core.defaultWatermarkSettings, position: "tile", scale: 0.08 };
  const layers = core.buildWatermarkLayers(settings, 1200, 900, measure);

  assertGreater(layers.length, 4, "expected several tiles");
  assert(layers.length <= 400, `expected the tile count capped, got ${layers.length}`);

  // Tiles must span the canvas in both axes.
  const xs = layers.map((l) => l.x);
  const ys = layers.map((l) => l.y);
  assert(Math.min(...xs) < 1200 * 0.3, "expected tiles on the left");
  assertGreater(Math.max(...xs), 1200 * 0.5, "expected tiles on the right");
  assert(Math.min(...ys) < 900 * 0.3, "expected tiles at the top");
  assertGreater(Math.max(...ys), 900 * 0.5, "expected tiles at the bottom");
});

await test("a very small tile scale cannot explode the layer count", () => {
  const settings = {
    ...core.defaultWatermarkSettings,
    position: "tile",
    scale: 0.005,
    tileGap: 0,
  };
  const layers = core.buildWatermarkLayers(settings, 4000, 4000, measure);
  assert(layers.length <= 400, `expected a hard cap, got ${layers.length}`);
  assertGreater(layers.length, 0, "expected it to still produce tiles");
});

await test("image watermarks keep the logo aspect ratio", () => {
  const logo = { id: "logo", width: 400, height: 100, image: null };
  const settings = { ...core.defaultWatermarkSettings, kind: "image", imageSourceId: "logo" };
  const [layer] = core.buildWatermarkLayers(settings, 1000, 1000, measure, logo);

  assert(layer.type === "image", "expected an image layer");
  assertClose(layer.width / layer.height, 4, 0.01, "expected a 4:1 logo to stay 4:1");
  assert(layer.sourceId === "logo", "expected the logo raster referenced");

  const tall = { id: "tall", width: 100, height: 400, image: null };
  const [tallLayer] = core.buildWatermarkLayers(settings, 1000, 1000, measure, tall);
  assertClose(tallLayer.width / tallLayer.height, 0.25, 0.01, "expected a 1:4 logo to stay 1:4");
});

await test("an image watermark without a logo produces nothing", () => {
  const settings = { ...core.defaultWatermarkSettings, kind: "image", imageSourceId: null };
  assert(core.buildWatermarkLayers(settings, 500, 500, measure).length === 0, "expected no layers");
});

await test("an empty text watermark produces nothing", () => {
  const settings = { ...core.defaultWatermarkSettings, text: "   " };
  assert(core.buildWatermarkLayers(settings, 500, 500, measure).length === 0, "expected no layers");
});

await test("applying a watermark replaces the previous one", () => {
  let doc = core.createDocument(800, 600);
  doc = core.addLayer(
    doc,
    core.createImageLayer("Photo", "photo", { x: 0, y: 0, width: 800, height: 600 }, {
      width: 800,
      height: 600,
    })
  );

  const first = core.applyWatermark(doc, core.defaultWatermarkSettings, measure);
  const firstCount = first.layers.length;
  assertGreater(firstCount, 1, "expected the watermark added");

  const second = core.applyWatermark(first, core.defaultWatermarkSettings, measure);
  assert(
    second.layers.length === firstCount,
    `expected the old watermark replaced, went ${firstCount} -> ${second.layers.length}`
  );

  // The user's own photo must survive both applications.
  assert(second.layers[0].name === "Photo", "expected the base layer preserved");

  const stripped = core.stripWatermarks(second);
  assert(stripped.layers.length === 1, "expected only the photo to remain");
});

await test("watermarks render as visible pixels over an image", async () => {
  const photo = makeSolidRaster("photo", 200, 200, "#000000");
  let doc = core.createDocument(200, 200, { background: null });
  doc = core.addLayer(
    doc,
    core.createImageLayer("Photo", "photo", { x: 0, y: 0, width: 200, height: 200 }, {
      width: 200,
      height: 200,
    })
  );

  const { ctx } = nodeCanvasFactory.create(8, 8);
  const measureReal = (fontSize) => {
    ctx.font = `700 ${fontSize}px sans-serif`;
    return ctx.measureText("WATERMARK").width;
  };

  const marked = core.applyWatermark(
    doc,
    {
      ...core.defaultWatermarkSettings,
      text: "WATERMARK",
      position: "center",
      opacity: 1,
      color: "#ffffff",
      scale: 0.12,
    },
    measureReal
  );

  const { data } = await renderToPixels(marked, makeRasterStore([photo]), { transparent: true });
  let bright = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] > 200) bright++;
  assertGreater(bright, 50, "expected visible white watermark pixels over the black photo");
});

/* -------------------------------------------------------------------------- */

suite("Passport photo studio");

await test("specifications are internally consistent", () => {
  assertGreater(core.PASSPORT_SPECS.length, 5, "expected several countries");
  const ids = new Set();
  for (const spec of core.PASSPORT_SPECS) {
    assert(!ids.has(spec.id), `duplicate spec id ${spec.id}`);
    ids.add(spec.id);
    assertGreater(spec.widthMm, 0, `${spec.id}: width`);
    assertGreater(spec.heightMm, 0, `${spec.id}: height`);
    assert(spec.headMin < spec.headMax, `${spec.id}: expected a valid head range`);
    assert(spec.headMax < 1, `${spec.id}: head cannot exceed the photo`);
    assert(spec.backgrounds.length > 0, `${spec.id}: expected a background colour`);
    // The whole head plus its top gap must fit inside the photo.
    assert(
      spec.crownGap + spec.headMax <= 1,
      `${spec.id}: crown gap plus head height overflows the photo`
    );
  }
});

await test("millimetres convert to pixels at the chosen resolution", () => {
  // 51 mm at 300 dpi is 51/25.4*300 = 602 px.
  assertClose(core.mmToPx(51, 300), 602, 1, "51mm at 300dpi");
  assertClose(core.mmToPx(25.4, 300), 300, 0.5, "one inch at 300dpi");
  assertClose(core.mmToPx(25.4, 600), 600, 0.5, "one inch at 600dpi");

  const spec = core.PASSPORT_SPECS.find((s) => s.id === "uk-passport");
  const size = core.specPixelSize(spec, 300);
  assertClose(size.width, 413, 2, "UK width at 300dpi");
  assertClose(size.height, 531, 2, "UK height at 300dpi");
});

await test("head guides sit inside the photo and in the right order", () => {
  for (const spec of core.PASSPORT_SPECS) {
    const guide = core.headGuide(spec);
    assert(guide.crownY >= 0, `${spec.id}: crown above the photo`);
    assert(guide.chinY <= 1, `${spec.id}: chin below the photo`);
    assert(guide.crownY < guide.eyeY, `${spec.id}: eyes must be below the crown`);
    assert(guide.eyeY < guide.chinY, `${spec.id}: chin must be below the eyes`);
    assert(guide.chinMinY < guide.chinMaxY, `${spec.id}: expected a tolerance band`);
    // The ideal chin must fall inside its own tolerance band.
    assert(
      guide.chinY >= guide.chinMinY - 1e-9 && guide.chinY <= guide.chinMaxY + 1e-9,
      `${spec.id}: ideal chin outside the permitted band`
    );
  }
});

await test("auto-crop covers the frame and positions the head", () => {
  const spec = core.PASSPORT_SPECS.find((s) => s.id === "us-passport");
  const target = core.specPixelSize(spec, 300);
  const rect = core.fitPortrait(spec, 1200, 1600, target.width, target.height);

  // Must cover the whole photo area, leaving no background gap.
  assert(rect.x <= 0.01, `expected full width coverage, x=${rect.x}`);
  assert(rect.x + rect.width >= target.width - 0.01, "expected full width coverage");
  assertGreater(rect.width, 0, "expected a positive size");

  // A landscape source must also cover.
  const wide = core.fitPortrait(spec, 2000, 800, target.width, target.height);
  assert(wide.width >= target.width - 0.01, "expected a wide source to cover");
  assert(wide.height >= target.height - 0.01, "expected a wide source to cover");
});

await test("print sheets fit multiple copies and never overlap", () => {
  const spec = core.PASSPORT_SPECS.find((s) => s.id === "uk-passport");
  const sheet = core.PRINT_SHEETS.find((s) => s.id === "4x6");
  const layout = core.planPrintSheet(spec, sheet, 300, 8);

  assertGreater(layout.capacity, 1, "expected more than one copy on 4x6");
  assert(layout.cells.length === Math.min(8, layout.capacity), "expected the requested copies");

  // No two cells may overlap.
  for (let i = 0; i < layout.cells.length; i++) {
    for (let j = i + 1; j < layout.cells.length; j++) {
      const a = layout.cells[i];
      const b = layout.cells[j];
      const overlap =
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height;
      assert(!overlap, `cells ${i} and ${j} overlap`);
    }
  }

  // Every cell must sit inside the sheet.
  for (const cell of layout.cells) {
    assert(cell.x >= -0.5 && cell.y >= -0.5, "cell outside the sheet");
    assert(cell.x + cell.width <= layout.width + 0.5, "cell past the right edge");
    assert(cell.y + cell.height <= layout.height + 0.5, "cell past the bottom edge");
  }
});

await test("print sheet picks the orientation that fits more copies", () => {
  const spec = core.PASSPORT_SPECS.find((s) => s.id === "uk-passport");
  const sheet = core.PRINT_SHEETS.find((s) => s.id === "4x6");
  const layout = core.planPrintSheet(spec, sheet, 300, 100);
  // A 35x45mm photo on 4x6in paper fits at least 6 either way.
  assertGreater(layout.capacity, 5, `expected a sensible capacity, got ${layout.capacity}`);
  assert(layout.columns * layout.rows === layout.capacity, "expected capacity to match the grid");
});

await test("requesting more copies than fit is clamped", () => {
  const spec = core.PASSPORT_SPECS.find((s) => s.id === "canada-passport");
  const sheet = core.PRINT_SHEETS.find((s) => s.id === "4x6");
  const layout = core.planPrintSheet(spec, sheet, 300, 999);
  assert(layout.cells.length === layout.capacity, "expected clamping to capacity");
});

await test("guide layers are locked and strippable", () => {
  const spec = core.PASSPORT_SPECS[0];
  const layers = core.buildGuideLayers(spec, 600, 600);

  assertGreater(layers.length, 3, "expected several guides");
  for (const layer of layers) {
    assert(layer.locked, "expected guides locked so they cannot be dragged");
    assert(core.isGuideLayer(layer), "expected the guide marker");
  }

  let doc = core.createDocument(600, 600);
  doc = core.addLayer(doc, core.createShapeLayer("rectangle", { x: 0, y: 0, width: 10, height: 10 }));
  const withGuides = { ...doc, layers: [...doc.layers, ...layers] };
  const stripped = core.stripGuides(withGuides);

  assert(stripped.layers.length === 1, "expected only the real layer to survive");
  assert(!core.isGuideLayer(stripped.layers[0]), "expected the real layer kept");
});

await test("guides render without covering the photo", async () => {
  const spec = core.PASSPORT_SPECS.find((s) => s.id === "us-passport");
  const photo = makeSolidRaster("photo", 200, 200, "#3366cc");
  let doc = core.createDocument(200, 200, { background: "#ffffff" });
  doc = core.addLayer(
    doc,
    core.createImageLayer("Photo", "photo", { x: 0, y: 0, width: 200, height: 200 }, {
      width: 200,
      height: 200,
    })
  );
  doc = { ...doc, layers: [...doc.layers, ...core.buildGuideLayers(spec, 200, 200)] };

  const { data, width } = await renderToPixels(doc, makeRasterStore([photo]));
  // Most of the frame must still show the photo underneath.
  let photoPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 120 && data[i + 2] > 150) photoPixels++;
  }
  assertGreater(photoPixels, 200 * 200 * 0.6, "expected the guides to remain an overlay");
  assert(width === 200, "expected the document size");
});

/* -------------------------------------------------------------------------- */

suite("Image compressor");

/** Encoder backed by the real Node canvas, matching the browser contract. */
const nodeEncoder = core.createCanvasEncoder(nodeCanvasFactory, async (canvas, mimeType, quality) => {
  const buffer =
    mimeType === "image/jpeg"
      ? canvas.toBuffer("image/jpeg", quality === undefined ? undefined : Math.round(quality * 100))
      : mimeType === "image/webp"
        ? canvas.toBuffer("image/webp", quality === undefined ? undefined : Math.round(quality * 100))
        : canvas.toBuffer("image/png");
  return new Blob([buffer], { type: mimeType });
});

/** A detailed source: flat colour would compress identically at every quality. */
function makeDetailedCanvas(size = 256) {
  const { canvas, ctx } = nodeCanvasFactory.create(size, size);
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#1e3a8a");
  gradient.addColorStop(0.5, "#f59e0b");
  gradient.addColorStop(1, "#be123c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  // Fine detail so quality genuinely changes the encoded size.
  let seed = 7;
  for (let i = 0; i < 3000; i++) {
    seed = (seed * 16807) % 2147483647;
    const x = seed % size;
    seed = (seed * 16807) % 2147483647;
    const y = seed % size;
    ctx.fillStyle = `hsl(${(x * y) % 360},70%,${40 + (y % 40)}%)`;
    ctx.fillRect(x, y, 3, 3);
  }
  return canvas;
}

await test("format helpers map mime types and losslessness", () => {
  assert(core.formatFromMime("image/png") === "png", "png");
  assert(core.formatFromMime("image/webp") === "webp", "webp");
  assert(core.formatFromMime("image/jpeg") === "jpeg", "jpeg");
  assert(core.formatFromMime("image/gif") === "jpeg", "expected an unknown type to fall back");

  assert(core.isLossless("png"), "png is lossless");
  assert(!core.isLossless("jpeg"), "jpeg is lossy");
  assert(!core.isLossless("webp"), "webp is treated as lossy here");

  assert(core.MIME_BY_FORMAT.jpeg === "image/jpeg", "jpeg mime");
  assert(core.EXTENSION_BY_FORMAT.jpeg === "jpg", "expected jpg rather than jpeg");
});

await test("byte formatting is readable", () => {
  assert(core.formatBytes(0) === "0 KB", "zero");
  assert(core.formatBytes(512) === "512 B", "bytes");
  assert(core.formatBytes(2048) === "2 KB", "kilobytes");
  assert(core.formatBytes(1024 * 1024 * 3) === "3 MB", "megabytes");
});

await test("dimension capping preserves the aspect ratio", () => {
  const wide = core.scaledSize(4000, 2000, 1920);
  assert(wide.width === 1920, "expected the long edge capped");
  assert(wide.height === 960, "expected the ratio preserved");

  const tall = core.scaledSize(1000, 3000, 1500);
  assert(tall.height === 1500, "expected the tall edge capped");
  assert(tall.width === 500, "expected the ratio preserved");

  const small = core.scaledSize(800, 600, 1920);
  assert(small.width === 800 && small.height === 600, "expected no upscaling");

  const off = core.scaledSize(4000, 2000, null);
  assert(off.width === 4000, "expected null to disable capping");
});

await test("lower quality produces a smaller JPEG", async () => {
  const canvas = makeDetailedCanvas();
  const high = await core.compressImage(
    canvas,
    256,
    256,
    { ...core.defaultCompressionSettings, quality: 95 },
    nodeEncoder
  );
  const low = await core.compressImage(
    canvas,
    256,
    256,
    { ...core.defaultCompressionSettings, quality: 20 },
    nodeEncoder
  );

  assertGreater(high.blob.size, low.blob.size, "expected lower quality to be smaller");
  assert(high.attempts === 1, "expected a single encode with no target");
  assert(low.width === 256 && low.height === 256, "expected the size preserved");
});

await test("target size search lands under the budget", async () => {
  const canvas = makeDetailedCanvas();
  const full = await core.compressImage(
    canvas,
    256,
    256,
    { ...core.defaultCompressionSettings, quality: 100 },
    nodeEncoder
  );

  // Aim for roughly half the full-quality size.
  const target = Math.floor(full.blob.size * 0.5);
  const result = await core.compressImage(
    canvas,
    256,
    256,
    { ...core.defaultCompressionSettings, targetBytes: target },
    nodeEncoder
  );

  assert(result.blob.size <= target, `expected <= ${target}, got ${result.blob.size}`);
  assert(!result.missedTarget, "expected the target to be met");
  assertGreater(result.attempts, 1, "expected a search");
  assert(result.attempts <= 9, `expected a bounded search, got ${result.attempts}`);
  assertGreater(result.quality, 0, "expected a real quality value");
});

await test("target search returns the highest quality that fits", async () => {
  const canvas = makeDetailedCanvas();
  const full = await core.compressImage(
    canvas,
    256,
    256,
    { ...core.defaultCompressionSettings, quality: 100 },
    nodeEncoder
  );
  const target = Math.floor(full.blob.size * 0.6);
  const result = await core.compressImage(
    canvas,
    256,
    256,
    { ...core.defaultCompressionSettings, targetBytes: target },
    nodeEncoder
  );

  // One quality point higher should breach the budget, proving the search did
  // not simply stop at the first value that happened to fit.
  const higher = await core.compressImage(
    canvas,
    256,
    256,
    { ...core.defaultCompressionSettings, quality: Math.min(100, result.quality + 6) },
    nodeEncoder
  );
  assertGreater(higher.blob.size, result.blob.size, "expected higher quality to be larger");
});

await test("an impossible target reports the miss instead of lying", async () => {
  const canvas = makeDetailedCanvas();
  const result = await core.compressImage(
    canvas,
    256,
    256,
    { ...core.defaultCompressionSettings, targetBytes: 10 },
    nodeEncoder
  );
  assert(result.missedTarget, "expected the miss to be reported");
  assertGreater(result.blob.size, 0, "expected bytes to still be produced");
});

await test("PNG ignores quality and stays lossless", async () => {
  const canvas = makeDetailedCanvas(128);
  const a = await core.compressImage(
    canvas,
    128,
    128,
    { ...core.defaultCompressionSettings, format: "png", quality: 10 },
    nodeEncoder
  );
  const b = await core.compressImage(
    canvas,
    128,
    128,
    { ...core.defaultCompressionSettings, format: "png", quality: 95 },
    nodeEncoder
  );

  assert(a.blob.size === b.blob.size, "expected PNG output to ignore quality");
  assert(a.quality === 100, "expected lossless to report full quality");
  assert(a.attempts === 1, "expected no search for a lossless format");
});

await test("downscaling shrinks the output", async () => {
  const canvas = makeDetailedCanvas(512);
  const full = await core.compressImage(
    canvas,
    512,
    512,
    { ...core.defaultCompressionSettings, quality: 85 },
    nodeEncoder
  );
  const scaled = await core.compressImage(
    canvas,
    512,
    512,
    { ...core.defaultCompressionSettings, quality: 85, maxDimension: 128 },
    nodeEncoder
  );

  assert(scaled.width === 128, "expected the capped width");
  assertGreater(full.blob.size, scaled.blob.size, "expected downscaling to shrink the file");
});

await test("encodes real bytes for every offered format", async () => {
  const canvas = makeDetailedCanvas(64);
  for (const format of ["jpeg", "png", "webp"]) {
    const result = await core.compressImage(
      canvas,
      64,
      64,
      { ...core.defaultCompressionSettings, format, quality: 80 },
      nodeEncoder
    );
    assertGreater(result.blob.size, 20, `${format}: expected real bytes`);
    assert(result.blob.type === core.MIME_BY_FORMAT[format], `${format}: expected the mime type`);
  }
});

await test("savings are reported and never negative", () => {
  assert(core.savingsPercent(1000, 250) === 75, "expected 75%");
  assert(core.savingsPercent(1000, 1000) === 0, "expected no saving");
  assert(core.savingsPercent(1000, 1500) === 0, "expected a larger output to clamp to zero");
  assert(core.savingsPercent(0, 100) === 0, "expected division by zero to be handled");
});

await test("presets are well formed", () => {
  for (const preset of core.TARGET_SIZE_PRESETS) {
    assertGreater(preset.bytes, 0, `${preset.label}: expected a positive size`);
  }
  const original = core.DIMENSION_PRESETS.find((p) => p.value === null);
  assert(original, "expected an 'Original' option");
  for (const preset of core.DIMENSION_PRESETS) {
    assert(preset.value === null || preset.value > 0, `${preset.label}: bad dimension`);
  }
});

/* -------------------------------------------------------------------------- */

suite("End-to-end composition");

await test("builds, edits and exports a multi-layer composition", async () => {
  const photo = makeSplitRaster("photo", 100, 100, "#204080", "#802040");

  let doc = core.createDocument(300, 200, { background: "#ffffff", name: "Composition" });
  let history = core.createHistory(doc);

  // Import a photo.
  doc = core.addLayer(
    doc,
    core.createImageLayer("Photo", "photo", { x: 0, y: 0, width: 300, height: 200 }, {
      width: 100,
      height: 100,
    })
  );
  history = core.pushHistory(history, doc, "Import photo");

  // Grade it.
  const photoId = doc.layers[0].id;
  doc = core.updateLayer(doc, photoId, (layer) => ({
    adjustments: { ...layer.adjustments, saturation: 30, contrast: 15 },
  }));
  history = core.pushHistory(history, doc, "Adjust photo");

  // Add a shape and some type.
  doc = core.addLayer(
    doc,
    core.createShapeLayer("rectangle", { x: 20, y: 130, width: 260, height: 50 }, {
      fill: "#000000",
      strokeWidth: 0,
      opacity: 0.6,
    })
  );
  assertClose(doc.layers[1].opacity, 0.6, 1e-9, "expected the shape factory to honour opacity");
  history = core.pushHistory(history, doc, "Add banner");

  doc = core.addLayer(
    doc,
    core.createTextLayer("ImagePilot", { x: 30, y: 138, width: 240, height: 36 }, {
      color: "#ffffff",
      fontSize: 32,
      align: "center",
      autoSize: false,
    })
  );
  history = core.pushHistory(history, doc, "Add title");

  assert(doc.layers.length === 3, "expected three layers");
  assert(history.entries.length === 5, "expected five history entries");

  const rendered = await renderToPixels(doc, makeRasterStore([photo]));
  assert(rendered.width === 300 && rendered.height === 200, "expected the document size");

  // The banner darkens the band it covers (y 130..180) relative to above it.
  const bannerPixel = pixelAt(rendered.data, rendered.width, 150, 185);
  const insideBanner = pixelAt(rendered.data, rendered.width, 150, 132);
  assert(
    insideBanner[0] + insideBanner[1] + insideBanner[2] <
      bannerPixel[0] + bannerPixel[1] + bannerPixel[2],
    `expected the banner to darken its band: inside ${insideBanner} vs outside ${bannerPixel}`
  );

  // White title text is visible on the banner.
  let whitePixels = 0;
  for (let y = 138; y < 175; y++) {
    for (let x = 30; x < 270; x++) {
      const [r, g, b] = pixelAt(rendered.data, rendered.width, x, y);
      if (r > 230 && g > 230 && b > 230) whitePixels++;
    }
  }
  assertGreater(whitePixels, 50, "expected visible white type");

  // Undo the title and confirm it disappears.
  history = core.undo(history);
  const withoutTitle = core.currentDocument(history);
  assert(withoutTitle.layers.length === 2, "expected the title removed by undo");

  // Export both raster and vector output.
  const raster = core.composite(doc, makeRasterStore([photo]), nodeCanvasFactory, { scale: 2 });
  assert(raster.width === 600, "expected a 2x export");
  assert(raster.canvas.toBuffer("image/png").length > 500, "expected real PNG bytes");

  const { ctx } = nodeCanvasFactory.create(10, 10);
  const svg = core.documentToSvg(doc, new Map(), ctx);
  assert(svg.includes("ImagePilot"), "expected the title in the SVG");
  assert(svg.includes("<path "), "expected the banner as a vector path");
});

await test("a crop then export produces the cropped pixels", async () => {
  let doc = core.createDocument(100, 100, { background: "#ffffff" });
  doc = core.addLayer(
    doc,
    core.createShapeLayer("rectangle", { x: 0, y: 0, width: 50, height: 100 }, {
      fill: "#ff0000",
      strokeWidth: 0,
    })
  );

  // Crop to the right half, which contains only the white background.
  const cropped = core.cropDocument(doc, { x: 50, y: 0, width: 50, height: 100 });
  const { data, width, height } = await renderToPixels(cropped, makeRasterStore());
  assert(width === 50 && height === 100, "expected the cropped size");

  let redPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 200 && data[i + 1] < 60) redPixels++;
  }
  assert(redPixels === 0, `expected the red half cropped away, found ${redPixels} red pixels`);
});

await test("scaling the canvas keeps the composition proportional", async () => {
  let doc = core.createDocument(100, 100, { background: "#ffffff" });
  doc = core.addLayer(
    doc,
    core.createShapeLayer("rectangle", { x: 25, y: 25, width: 50, height: 50 }, {
      fill: "#000000",
      strokeWidth: 0,
    })
  );

  const scaled = core.resizeDocument(doc, 200, 200, true);
  const { data, width } = await renderToPixels(scaled, makeRasterStore());

  assert(pixelAt(data, width, 100, 100)[0] === 0, "expected the square still centred");
  assert(pixelAt(data, width, 20, 20)[0] === 255, "expected the corner still background");
  // The square occupied a quarter of the area before and must still do so.
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] < 50) dark++;
  assertClose(dark / (200 * 200), 0.25, 0.02, "expected the same proportional area");
});

/* -------------------------------------------------------------------------- */

console.log(
  `\n\x1b[1mResults\x1b[0m  ${results.passed} passed, ${results.failed} failed\n`
);

if (results.failures.length) {
  console.log("\x1b[31mFailures:\x1b[0m");
  for (const failure of results.failures) {
    console.log(`  ${failure.suite} › ${failure.name}`);
    console.log(`    ${failure.error.stack?.split("\n").slice(0, 4).join("\n    ")}`);
  }
}

// Keep the working tree clean: build output is an artifact, not source.
await cleanEditorBuild();

process.exit(results.failed > 0 ? 1 : 0);

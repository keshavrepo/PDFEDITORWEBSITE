/**
 * OfficePilot Presentation → PPTX exporter.
 *
 * Uses the `pptxgenjs` library which produces real OOXML PowerPoint
 * files. The exporter maps the OfficePilot body one-to-one onto PPTX
 * primitives: slides, text frames, shapes, images, tables, notes,
 * transitions and theme colours.
 *
 * The exporter is browser-friendly; the resulting blob is a real
 * `.pptx` file the user can open in PowerPoint, Keynote or Google
 * Slides.
 */

import PPTXGenJS from "pptxgenjs";
import {
  PRESENTATION_THEMES,
  type PresentationBlock,
  type PresentationBody,
  type PresentationRun,
  type PresentationSlide,
} from "./schema";

/** Maps an OfficePilot transition to a PPTXGenJS transition name. */
function mapTransition(transition: string): { type: string; duration?: number; direction?: string } {
  switch (transition) {
    case "fade":
      return { type: "fade", duration: 0.4 };
    case "slide":
      return { type: "slide", direction: "left", duration: 0.4 };
    case "zoom":
      return { type: "zoom", duration: 0.4 };
    case "push":
      return { type: "push", direction: "right", duration: 0.4 };
    default:
      return { type: "none" };
  }
}

/** Converts a hex colour to a stripped form for pptxgenjs. */
function colorWithoutHash(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^#/, "").toLowerCase();
}

/** Builds a run for pptxgenjs text. */
function buildRun(run: PresentationRun): PPTXGenJS.TextProps {
  const props: PPTXGenJS.TextProps = {
    text: run.text,
    options: {
      bold: run.bold,
      italic: run.italic,
      underline: run.underline ? { style: "sng" } : undefined,
      fontSize: run.fontSize,
      color: colorWithoutHash(run.color),
      fontFace: run.font,
      hyperlink: run.href ? { url: run.href } : undefined,
    },
  };
  return props;
}

/** Adds a content block to a slide. */
function addBlock(slide: PPTXGenJS.Slide, block: PresentationBlock, slideWidth: number, slideHeight: number, defaultFont: string, defaultColor: string) {
  switch (block.type) {
    case "text": {
      const text = block.runs.map((run) => buildRun(run));
      slide.addText(text as never, {
        x: 0.5,
        y: 1.2,
        w: slideWidth - 1,
        h: slideHeight - 2,
        fontFace: defaultFont,
        color: colorWithoutHash(defaultColor) ?? "000000",
        fontSize: 18,
        valign: "top",
      });
      return;
    }
    case "bullets": {
      const lines: PPTXGenJS.TextProps[] = block.items.map((item) => {
        const runs = item.map((run) => buildRun(run));
        return { text: runs, options: { bullet: true } } as unknown as PPTXGenJS.TextProps;
      });
      slide.addText(lines as never, {
        x: 0.5,
        y: 1.2,
        w: slideWidth - 1,
        h: slideHeight - 2,
        fontFace: defaultFont,
        color: colorWithoutHash(defaultColor) ?? "000000",
        fontSize: 18,
        valign: "top",
        paraSpaceAfter: 6,
      });
      return;
    }
    case "shape": {
      const x = (block.x / 100) * slideWidth;
      const y = (block.y / 100) * slideHeight;
      const w = (block.width / 100) * slideWidth;
      const h = (block.height / 100) * slideHeight;
      const shapeName = shapeNameFor(block.kind);
      const options: PPTXGenJS.ShapeProps = {
        x,
        y,
        w,
        h,
        fill: block.fill ? { color: colorWithoutHash(block.fill) } : undefined,
        line: block.stroke
          ? { color: colorWithoutHash(block.stroke), width: block.strokeWidth ?? 1 }
          : undefined,
      };
      slide.addShape(shapeName as never, options);
      if (block.text && block.text.length > 0) {
        slide.addText(
          block.text.map((run) => buildRun(run)) as never,
          { x, y, w, h, align: "center", valign: "middle" }
        );
      }
      return;
    }
    case "image": {
      const x = (block.x / 100) * slideWidth;
      const y = (block.y / 100) * slideHeight;
      const w = (block.width / 100) * slideWidth;
      const h = (block.height / 100) * slideHeight;
      slide.addImage({ path: block.src, x, y, w, h } as never);
      return;
    }
    case "table": {
      const x = (block.x / 100) * slideWidth;
      const y = (block.y / 100) * slideHeight;
      const w = (block.width / 100) * slideWidth;
      const headerCellStyle: PPTXGenJS.TableCellProps = block.header
        ? ({
            fill: { color: colorWithoutHash(block.headerFill) ?? "0a0a0a" },
            color: block.headerFill ? "FFFFFF" : colorWithoutHash(defaultColor) ?? "000000",
            bold: true,
          } as PPTXGenJS.TableCellProps)
        : ({} as PPTXGenJS.TableCellProps);
      const rows: PPTXGenJS.TableRow[] = block.rows.map((row, rowIndex) =>
        row.map((text) => ({
          text,
          options: rowIndex === 0 && block.header ? headerCellStyle : ({} as PPTXGenJS.TableCellProps),
        }))
      );
      slide.addTable(rows, {
        x,
        y,
        w,
        colW: Array(Math.max(1, block.rows[0]?.length ?? 1)).fill(w / Math.max(1, block.rows[0]?.length ?? 1)),
        border: { type: "solid", pt: 0.5, color: "E4E4E7" },
        fontSize: 14,
        fontFace: defaultFont,
      });
      return;
    }
    default:
      return;
  }
}

/** Maps a shape kind to a pptxgenjs shape name. */
function shapeNameFor(kind: string): string {
  switch (kind) {
    case "rectangle":
      return "rect";
    case "rounded-rectangle":
      return "roundRect";
    case "ellipse":
      return "ellipse";
    case "line":
      return "line";
    case "arrow":
      return "rightArrow";
    case "triangle":
      return "triangle";
    default:
      return "rect";
  }
}

/** Renders a slide background. */
function applyBackground(slide: PPTXGenJS.Slide, slideData: PresentationSlide, deckBackground: { kind: "color" | "gradient"; color: string; color2?: string; angle?: number }) {
  const background = slideData.background ?? deckBackground;
  if (background.kind === "color") {
    slide.background = { color: colorWithoutHash(background.color) ?? "FFFFFF" };
  } else {
    // pptxgenjs has no gradient background; fall back to the first stop.
    slide.background = { color: colorWithoutHash(background.color) ?? "FFFFFF" };
  }
}

/** Returns a PPTX file as a Blob. */
export async function exportPresentationToPptx(body: PresentationBody, meta: { title: string }): Promise<Blob> {
  const pptx = new PPTXGenJS();
  pptx.title = meta.title;
  pptx.author = "LaunchStack OfficePilot";
  pptx.company = "LaunchStack";
  const deck = body.settings;
  const palette = PRESENTATION_THEMES[deck.theme];
  const slideWidth = deck.aspect === "16:9" ? 13.333 : 10;
  const slideHeight = deck.aspect === "16:9" ? 7.5 : 7.5;
  pptx.defineLayout({ name: "OFFICEPILOT", width: slideWidth, height: slideHeight });
  pptx.layout = "OFFICEPILOT";

  for (const slide of body.slides) {
    const s = pptx.addSlide();
    applyBackground(s, slide, deck.background);
    const fontColor = slide.background?.color === "0a0a0a" || slide.background?.color === "0F172A" ? "#FAFAFA" : deck.fontColor;
    // Title.
    s.addText(slide.title, {
      x: 0.5,
      y: 0.4,
      w: slideWidth - 1,
      h: 0.8,
      fontSize: 32,
      bold: true,
      color: colorWithoutHash(fontColor) ?? colorWithoutHash(palette.fontColor) ?? "0A0A0A",
      fontFace: deck.fontFamily,
      valign: "middle",
    });
    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 0.5,
        y: 1.1,
        w: slideWidth - 1,
        h: 0.4,
        fontSize: 16,
        italic: true,
        color: colorWithoutHash(fontColor) ?? colorWithoutHash(palette.accent) ?? "0A0A0A",
        fontFace: deck.fontFamily,
      });
    }
    // Blocks.
    for (const block of slide.blocks) {
      addBlock(s, block, slideWidth, slideHeight, deck.fontFamily, fontColor);
    }
    // Notes.
    if (slide.notes.trim()) {
      s.addNotes(slide.notes);
    }
    // Transition.
    (s as unknown as { transition: { type: string; duration?: number; direction?: string } }).transition = mapTransition(slide.transition);
  }

  const buffer = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

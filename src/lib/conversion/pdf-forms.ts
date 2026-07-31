/**
 * Fillable PDF form inspection and filling.
 *
 * Reads an AcroForm's fields into a plain description the UI can render, then
 * writes user-supplied values back. pdf-lib owns the low-level AcroForm work;
 * this module keeps the UI free of pdf-lib types and handles the awkward parts
 * (page mapping, read-only fields, appearance regeneration, flattening).
 */

import {
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  StandardFonts,
  type PDFField,
} from "pdf-lib";
import { conversionErrors } from "./errors";
import type { ConversionProgressCallback } from "./types";

export type FormFieldType =
  | "text"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "optionlist"
  | "signature"
  | "button";

export interface FormFieldRect {
  /** Zero-based page index the widget lives on. */
  pageIndex: number;
  /** Position in points, top-left origin, matching the preview renderer. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FormFieldDescriptor {
  name: string;
  type: FormFieldType;
  readOnly: boolean;
  required: boolean;
  /** Current value: string for text, string for single choice, array for lists. */
  value: string | string[] | boolean | null;
  /** Available choices for radio groups, dropdowns and option lists. */
  options?: string[];
  multiline?: boolean;
  /** Maximum accepted length for text fields, when the PDF declares one. */
  maxLength?: number;
  /** Widget rectangles, so the UI can highlight fields on a page preview. */
  rects: FormFieldRect[];
}

export interface FormInspection {
  hasForm: boolean;
  fields: FormFieldDescriptor[];
  pageCount: number;
  /** Page sizes in points, used to scale the preview overlay. */
  pageSizes: Array<{ width: number; height: number }>;
  /** True when the document declares XFA, which browsers cannot fill. */
  isXfa: boolean;
}

/** Values keyed by field name. */
export type FormValues = Record<string, string | string[] | boolean | null>;

export interface FillFormOptions {
  /** Flatten so the result is no longer editable. */
  flatten?: boolean;
  signal?: AbortSignal;
}

function classify(field: PDFField): FormFieldType {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFDropdown) return "dropdown";
  if (field instanceof PDFOptionList) return "optionlist";
  if (field instanceof PDFSignature) return "signature";
  return "button";
}

/**
 * Resolves each widget to a page index and a top-left rectangle.
 *
 * Widgets reference their page through `/P`, but that entry is optional, so
 * the page's own annotation list is used as a fallback.
 */
function readRects(
  field: PDFField,
  pageRefs: Array<{ ref: unknown; width: number; height: number; annots: unknown[] }>
): FormFieldRect[] {
  const rects: FormFieldRect[] = [];

  for (const widget of field.acroField.getWidgets()) {
    let pageIndex = -1;
    const parent = widget.P();
    if (parent) {
      pageIndex = pageRefs.findIndex((page) => page.ref === parent);
    }
    if (pageIndex === -1) {
      // Fall back to whichever page lists this widget as an annotation.
      const widgetRef = widget.dict;
      pageIndex = pageRefs.findIndex((page) =>
        page.annots.some((annotation) => annotation === widgetRef)
      );
    }
    if (pageIndex === -1) pageIndex = 0;

    const page = pageRefs[pageIndex];
    let rectangle;
    try {
      rectangle = widget.getRectangle();
    } catch {
      continue;
    }

    rects.push({
      pageIndex,
      x: rectangle.x,
      // Convert PDF's bottom-left origin into the top-left space the preview uses.
      y: (page?.height ?? 0) - rectangle.y - rectangle.height,
      width: rectangle.width,
      height: rectangle.height,
    });
  }

  return rects;
}

function readValue(field: PDFField, type: FormFieldType): FormFieldDescriptor["value"] {
  try {
    if (type === "text") return (field as PDFTextField).getText() ?? "";
    if (type === "checkbox") return (field as PDFCheckBox).isChecked();
    if (type === "radio") return (field as PDFRadioGroup).getSelected() ?? null;
    if (type === "dropdown") return (field as PDFDropdown).getSelected()[0] ?? null;
    if (type === "optionlist") return (field as PDFOptionList).getSelected();
  } catch {
    // Malformed values must not stop the whole form loading.
  }
  return null;
}

function readOptions(field: PDFField, type: FormFieldType): string[] | undefined {
  try {
    if (type === "radio") return (field as PDFRadioGroup).getOptions();
    if (type === "dropdown") return (field as PDFDropdown).getOptions();
    if (type === "optionlist") return (field as PDFOptionList).getOptions();
  } catch {
    return undefined;
  }
  return undefined;
}

async function loadDocument(data: Uint8Array): Promise<PDFDocument> {
  try {
    // Field values are only readable when the document is not encrypted.
    return await PDFDocument.load(data, { updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("encrypted") || message.includes("password")) {
      throw conversionErrors.encrypted();
    }
    throw conversionErrors.corrupted("PDF", error);
  }
}

/** Reads every fillable field from a PDF. */
export async function inspectPdfForm(data: Uint8Array): Promise<FormInspection> {
  const pdf = await loadDocument(data);
  const pages = pdf.getPages();

  const pageRefs = pages.map((page) => {
    const annotations = page.node.Annots();
    const list: unknown[] = [];
    if (annotations) {
      for (let index = 0; index < annotations.size(); index++) {
        list.push(annotations.lookup(index));
      }
    }
    const size = page.getSize();
    return { ref: page.ref, width: size.width, height: size.height, annots: list };
  });

  let fields: PDFField[] = [];
  let hasForm = false;
  try {
    const form = pdf.getForm();
    fields = form.getFields();
    hasForm = fields.length > 0;
  } catch {
    // A document without an AcroForm simply has no fields.
    hasForm = false;
  }

  // XFA forms carry their real definition in an XML payload that pdf-lib
  // cannot fill, so they are reported rather than silently mishandled.
  const isXfa = detectXfa(pdf);

  const descriptors: FormFieldDescriptor[] = fields.map((field) => {
    const type = classify(field);
    const descriptor: FormFieldDescriptor = {
      name: field.getName(),
      type,
      readOnly: field.isReadOnly(),
      required: field.isRequired(),
      value: readValue(field, type),
      options: readOptions(field, type),
      rects: readRects(field, pageRefs),
    };

    if (type === "text") {
      const textField = field as PDFTextField;
      descriptor.multiline = textField.isMultiline();
      const maxLength = textField.getMaxLength();
      if (typeof maxLength === "number" && maxLength > 0) descriptor.maxLength = maxLength;
    }
    return descriptor;
  });

  return {
    hasForm,
    fields: descriptors,
    pageCount: pages.length,
    pageSizes: pageRefs.map((page) => ({ width: page.width, height: page.height })),
    isXfa,
  };
}

/**
 * XFA forms keep their real definition in an XML payload that pdf-lib cannot
 * fill, so they must be reported instead of silently mishandled.
 */
function detectXfa(pdf: PDFDocument): boolean {
  try {
    const acroForm = pdf.catalog.lookup(PDFName.of("AcroForm"));
    if (!(acroForm instanceof PDFDict)) return false;
    return acroForm.has(PDFName.of("XFA"));
  } catch {
    return false;
  }
}

/**
 * Applies values to a form and returns the saved PDF.
 *
 * Appearances are regenerated so filled values are visible in every viewer,
 * including those that ignore `NeedAppearances`.
 */
export async function fillPdfForm(
  data: Uint8Array,
  values: FormValues,
  options: FillFormOptions = {},
  onProgress?: ConversionProgressCallback
): Promise<Uint8Array> {
  onProgress?.({ stage: "Reading form", progress: 5, total: 100 });

  const pdf = await loadDocument(data);
  let form;
  try {
    form = pdf.getForm();
  } catch {
    throw conversionErrors.invalidRequest("This PDF does not contain a fillable form");
  }

  const fields = form.getFields();
  if (!fields.length) {
    throw conversionErrors.invalidRequest("This PDF does not contain a fillable form");
  }

  // A standard font guarantees filled text renders even when the PDF's own
  // resources omit one.
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const total = fields.length || 1;
  fields.forEach((field, index) => {
    if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");

    if (index % 5 === 0) {
      onProgress?.({
        stage: "Filling fields",
        progress: 10 + Math.round((index / total) * 70),
        total: 100,
      });
    }

    const name = field.getName();
    if (!(name in values)) return;
    // Read-only fields are shown disabled in the UI and must stay untouched.
    if (field.isReadOnly()) return;

    const value = values[name];
    applyValue(field, value);
  });

  onProgress?.({ stage: "Updating appearances", progress: 85, total: 100 });
  try {
    form.updateFieldAppearances(font);
  } catch {
    // Appearance generation can fail on unusual fonts; the values are still set.
  }

  if (options.flatten) flattenForm(form);

  onProgress?.({ stage: "Saving PDF", progress: 95, total: 100 });
  const bytes = await pdf.save();
  onProgress?.({ stage: "Completed", progress: 100, total: 100 });
  return bytes;
}

/**
 * Flattens a form, tolerating fields that cannot be flattened.
 *
 * pdf-lib throws on signature fields because they have no appearance stream.
 * Flattening the remaining fields individually keeps the rest of the form
 * flattened instead of failing the whole operation, and any field that resists
 * is simply left interactive.
 */
function flattenForm(form: ReturnType<PDFDocument["getForm"]>): void {
  try {
    form.flatten();
    return;
  } catch {
    // Fall through to per-field flattening.
  }

  for (const field of form.getFields()) {
    // Signature fields have no appearance to flatten into the page.
    if (field instanceof PDFSignature) continue;
    try {
      field.enableReadOnly();
      form.flatten({ updateFieldAppearances: false });
      return;
    } catch {
      // Keep trying the remaining fields.
    }
  }

  // Last resort: mark every field read-only so values cannot be changed.
  for (const field of form.getFields()) {
    try {
      field.enableReadOnly();
    } catch {
      // Nothing further can be done for this field.
    }
  }
}

/** Writes one value, ignoring types that cannot accept it. */
function applyValue(field: PDFField, value: string | string[] | boolean | null): void {
  try {
    if (field instanceof PDFTextField) {
      field.setText(value === null || value === undefined ? "" : String(value));
      return;
    }

    if (field instanceof PDFCheckBox) {
      if (value === true || value === "true" || value === "on") field.check();
      else field.uncheck();
      return;
    }

    if (field instanceof PDFRadioGroup) {
      if (typeof value === "string" && value) {
        // Selecting an option the group does not define would throw.
        if (field.getOptions().includes(value)) field.select(value);
      } else {
        field.clear();
      }
      return;
    }

    if (field instanceof PDFDropdown) {
      if (typeof value === "string" && value) {
        const options = field.getOptions();
        if (options.includes(value)) field.select(value);
        else {
          // Editable dropdowns accept free text.
          field.setOptions([...options, value]);
          field.select(value);
        }
      } else {
        field.clear();
      }
      return;
    }

    if (field instanceof PDFOptionList) {
      const selection = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
      const options = field.getOptions();
      const valid = selection.filter((entry) => options.includes(entry));
      if (!valid.length) {
        field.clear();
        return;
      }
      // `select` replaces the selection unless merging is requested, so every
      // entry after the first must merge to keep a multi-select intact.
      field.select(valid[0], false);
      for (const entry of valid.slice(1)) field.select(entry, true);
    }
  } catch {
    // A single unwritable field must never fail the whole fill operation.
  }
}

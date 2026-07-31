"use client";

/**
 * Right-hand inspector.
 *
 * Shows the properties of the current selection: geometry for every layer,
 * plus type controls for text and fill/stroke controls for shapes. With
 * nothing selected it falls back to document settings, so the panel is never
 * an empty column.
 */

import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  FlipHorizontal,
  FlipVertical,
  Italic,
  RotateCw,
  Underline,
} from "lucide-react";
import {
  CANVAS_PRESETS,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  MAX_CANVAS_DIMENSION,
  type EditorDocument,
  type Layer,
  type ShapeLayer,
  type TextLayer,
} from "@/lib/imagepilot/core";
import type { EditorAction } from "@/lib/imagepilot/editor-state";
import {
  ColorField,
  FieldRow,
  NumberField,
  PanelSection,
  SegmentedControl,
  SelectField,
  SliderField,
  ToggleField,
  ToolbarButton,
} from "./editor-controls";

interface PropertiesPanelProps {
  document: EditorDocument;
  selection: Layer[];
  dispatch: (action: EditorAction) => void;
  onResizeCanvas: () => void;
}

export function PropertiesPanel({
  document: doc,
  selection,
  dispatch,
  onResizeCanvas,
}: PropertiesPanelProps) {
  const layer = selection.length === 1 ? selection[0] : null;

  /** Patches the single selected layer. */
  const patch = (changes: Partial<Layer>, label: string, mergeKey?: string) => {
    if (!layer) return;
    dispatch({ type: "update-layer", id: layer.id, patch: changes, label, mergeKey });
  };

  if (!selection.length) {
    return <DocumentProperties document={doc} dispatch={dispatch} onResizeCanvas={onResizeCanvas} />;
  }

  if (selection.length > 1) {
    return (
      <div>
        <PanelSection title={`${selection.length} layers selected`}>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Alignment, ordering, opacity and deletion apply to the whole selection. Select a
            single layer to edit its individual properties.
          </p>
          <AlignmentControls dispatch={dispatch} />
          <SliderField
            label="Opacity"
            value={100}
            min={0}
            max={100}
            neutral={100}
            unit="%"
            onChange={(value) =>
              dispatch({
                type: "update-selected",
                patch: () => ({ opacity: value / 100 }),
                label: "Layer opacity",
                mergeKey: "opacity:multi",
              })
            }
          />
        </PanelSection>
      </div>
    );
  }

  return (
    <div>
      <PanelSection title="Transform">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="X"
            value={Math.round(layer!.x)}
            disabled={layer!.locked}
            onChange={(value) => patch({ x: value }, "Move layer", `x:${layer!.id}`)}
          />
          <NumberField
            label="Y"
            value={Math.round(layer!.y)}
            disabled={layer!.locked}
            onChange={(value) => patch({ y: value }, "Move layer", `y:${layer!.id}`)}
          />
          <NumberField
            label="Width"
            value={Math.round(layer!.width)}
            min={1}
            max={MAX_CANVAS_DIMENSION}
            disabled={layer!.locked}
            onChange={(value) =>
              patch(
                layer!.type === "text"
                  ? { width: value, autoSize: false }
                  : { width: value },
                "Resize layer",
                `w:${layer!.id}`
              )
            }
          />
          <NumberField
            label="Height"
            value={Math.round(layer!.height)}
            min={1}
            max={MAX_CANVAS_DIMENSION}
            disabled={layer!.locked}
            onChange={(value) => patch({ height: value }, "Resize layer", `h:${layer!.id}`)}
          />
        </div>

        <SliderField
          label="Rotation"
          value={Math.round(layer!.rotation)}
          min={0}
          max={359}
          neutral={0}
          unit="°"
          disabled={layer!.locked}
          onChange={(value) => patch({ rotation: value }, "Rotate layer", `rot:${layer!.id}`)}
        />

        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={<RotateCw className="h-3.5 w-3.5" />}
            label="Rotate 90° clockwise"
            disabled={layer!.locked}
            onClick={() => patch({ rotation: (layer!.rotation + 90) % 360 }, "Rotate 90°")}
          />
          <ToolbarButton
            icon={<FlipHorizontal className="h-3.5 w-3.5" />}
            label="Flip horizontally"
            active={layer!.flipX}
            disabled={layer!.locked}
            onClick={() => patch({ flipX: !layer!.flipX }, "Flip layer")}
          />
          <ToolbarButton
            icon={<FlipVertical className="h-3.5 w-3.5" />}
            label="Flip vertically"
            active={layer!.flipY}
            disabled={layer!.locked}
            onClick={() => patch({ flipY: !layer!.flipY }, "Flip layer")}
          />
          {layer!.type === "image" && (
            <button
              type="button"
              disabled={layer!.locked}
              onClick={() =>
                patch(
                  {
                    width: (layer as Extract<Layer, { type: "image" }>).naturalWidth,
                    height: (layer as Extract<Layer, { type: "image" }>).naturalHeight,
                  },
                  "Reset size"
                )
              }
              className="ml-auto rounded-lg px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              Original size
            </button>
          )}
        </div>

        <AlignmentControls dispatch={dispatch} />
      </PanelSection>

      {layer!.type === "text" && (
        <TextProperties layer={layer as TextLayer} patch={patch} />
      )}

      {layer!.type === "shape" && (
        <ShapeProperties layer={layer as ShapeLayer} patch={patch} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Alignment                                                                  */
/* -------------------------------------------------------------------------- */

function AlignmentControls({ dispatch }: { dispatch: (action: EditorAction) => void }) {
  const buttons = [
    { mode: "left" as const, icon: <AlignLeft className="h-3.5 w-3.5" />, label: "Align left" },
    { mode: "center-x" as const, icon: <AlignCenterHorizontal className="h-3.5 w-3.5" />, label: "Align centre horizontally" },
    { mode: "right" as const, icon: <AlignRight className="h-3.5 w-3.5" />, label: "Align right" },
    { mode: "top" as const, icon: <AlignStartHorizontal className="h-3.5 w-3.5" />, label: "Align top" },
    { mode: "center-y" as const, icon: <AlignCenterVertical className="h-3.5 w-3.5" />, label: "Align centre vertically" },
    { mode: "bottom" as const, icon: <AlignEndHorizontal className="h-3.5 w-3.5" />, label: "Align bottom" },
  ];

  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-muted-foreground">Align</span>
      <div className="flex items-center gap-0.5">
        {buttons.map((button) => (
          <ToolbarButton
            key={button.mode}
            icon={button.icon}
            label={button.label}
            onClick={() => dispatch({ type: "align-selected", mode: button.mode })}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

function TextProperties({
  layer,
  patch,
}: {
  layer: TextLayer;
  patch: (changes: Partial<Layer>, label: string, mergeKey?: string) => void;
}) {
  return (
    <>
      <PanelSection title="Type">
        <FieldRow label="Content" htmlFor="text-content">
          <textarea
            id="text-content"
            rows={3}
            value={layer.text}
            disabled={layer.locked}
            onChange={(event) => patch({ text: event.target.value }, "Edit text", `text:${layer.id}`)}
            className="w-full resize-y rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
        </FieldRow>

        <SelectField
          label="Font"
          value={layer.fontFamily}
          disabled={layer.locked}
          options={FONT_FAMILIES.map((font) => ({ value: font.value, label: font.label }))}
          onChange={(value) => patch({ fontFamily: value }, "Change font")}
        />

        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Size"
            value={Math.round(layer.fontSize)}
            min={1}
            max={800}
            suffix="px"
            disabled={layer.locked}
            onChange={(value) => patch({ fontSize: value }, "Font size", `size:${layer.id}`)}
          />
          <SelectField
            label="Weight"
            value={layer.fontWeight}
            disabled={layer.locked}
            options={FONT_WEIGHTS.map((weight) => ({ value: weight, label: String(weight) }))}
            onChange={(value) => patch({ fontWeight: value }, "Font weight")}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Letter spacing"
            value={layer.letterSpacing}
            min={-50}
            max={200}
            step={0.5}
            suffix="px"
            disabled={layer.locked}
            onChange={(value) => patch({ letterSpacing: value }, "Letter spacing", `ls:${layer.id}`)}
          />
          <NumberField
            label="Line height"
            value={layer.lineHeight}
            min={0.5}
            max={4}
            step={0.05}
            suffix="×"
            disabled={layer.locked}
            onChange={(value) => patch({ lineHeight: value }, "Line height", `lh:${layer.id}`)}
          />
        </div>

        <SegmentedControl
          label="Alignment"
          value={layer.align}
          disabled={layer.locked}
          options={[
            { value: "left", label: "Left", icon: <AlignLeft className="h-3.5 w-3.5" /> },
            { value: "center", label: "Centre", icon: <AlignCenter className="h-3.5 w-3.5" /> },
            { value: "right", label: "Right", icon: <AlignRight className="h-3.5 w-3.5" /> },
          ]}
          onChange={(value) => patch({ align: value }, "Text alignment")}
        />

        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={<Italic className="h-3.5 w-3.5" />}
            label="Italic"
            active={layer.italic}
            disabled={layer.locked}
            onClick={() => patch({ italic: !layer.italic }, "Italic")}
          />
          <ToolbarButton
            icon={<Underline className="h-3.5 w-3.5" />}
            label="Underline"
            active={layer.underline}
            disabled={layer.locked}
            onClick={() => patch({ underline: !layer.underline }, "Underline")}
          />
        </div>

        <ToggleField
          label="Auto-size box"
          hint="Grows with the text; turn off to wrap at a fixed width"
          checked={layer.autoSize}
          disabled={layer.locked}
          onChange={(checked) => patch({ autoSize: checked }, "Auto-size")}
        />
      </PanelSection>

      <PanelSection title="Text appearance">
        <ColorField
          label="Colour"
          value={layer.color}
          disabled={layer.locked}
          onChange={(value) => patch({ color: value }, "Text colour", `color:${layer.id}`)}
        />

        <NumberField
          label="Stroke width"
          value={layer.strokeWidth}
          min={0}
          max={40}
          step={0.5}
          suffix="px"
          disabled={layer.locked}
          onChange={(value) => patch({ strokeWidth: value }, "Text stroke", `stroke:${layer.id}`)}
        />
        {layer.strokeWidth > 0 && (
          <ColorField
            label="Stroke colour"
            value={layer.strokeColor}
            disabled={layer.locked}
            onChange={(value) => patch({ strokeColor: value }, "Stroke colour", `sc:${layer.id}`)}
          />
        )}

        <ToggleField
          label="Drop shadow"
          checked={layer.shadow.enabled}
          disabled={layer.locked}
          onChange={(checked) =>
            patch({ shadow: { ...layer.shadow, enabled: checked } }, "Text shadow")
          }
        />

        {layer.shadow.enabled && (
          <>
            <ColorField
              label="Shadow colour"
              value={layer.shadow.color}
              disabled={layer.locked}
              onChange={(value) =>
                patch({ shadow: { ...layer.shadow, color: value } }, "Shadow colour", `shc:${layer.id}`)
              }
            />
            <SliderField
              label="Shadow blur"
              value={layer.shadow.blur}
              min={0}
              max={60}
              neutral={8}
              disabled={layer.locked}
              onChange={(value) =>
                patch({ shadow: { ...layer.shadow, blur: value } }, "Shadow blur", `shb:${layer.id}`)
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Offset X"
                value={layer.shadow.offsetX}
                min={-100}
                max={100}
                disabled={layer.locked}
                onChange={(value) =>
                  patch({ shadow: { ...layer.shadow, offsetX: value } }, "Shadow offset", `shx:${layer.id}`)
                }
              />
              <NumberField
                label="Offset Y"
                value={layer.shadow.offsetY}
                min={-100}
                max={100}
                disabled={layer.locked}
                onChange={(value) =>
                  patch({ shadow: { ...layer.shadow, offsetY: value } }, "Shadow offset", `shy:${layer.id}`)
                }
              />
            </div>
          </>
        )}
      </PanelSection>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

function ShapeProperties({
  layer,
  patch,
}: {
  layer: ShapeLayer;
  patch: (changes: Partial<Layer>, label: string, mergeKey?: string) => void;
}) {
  const supportsFill = layer.shape !== "line";

  return (
    <PanelSection title="Shape">
      {supportsFill && (
        <>
          <ToggleField
            label="Fill"
            checked={layer.fillEnabled}
            disabled={layer.locked}
            onChange={(checked) => patch({ fillEnabled: checked }, "Shape fill")}
          />
          {layer.fillEnabled && (
            <ColorField
              label="Fill colour"
              value={layer.fill}
              disabled={layer.locked}
              onChange={(value) => patch({ fill: value }, "Fill colour", `fill:${layer.id}`)}
            />
          )}
        </>
      )}

      <NumberField
        label="Stroke width"
        value={layer.strokeWidth}
        min={0}
        max={100}
        step={0.5}
        suffix="px"
        disabled={layer.locked}
        onChange={(value) => patch({ strokeWidth: value }, "Stroke width", `sw:${layer.id}`)}
      />
      {layer.strokeWidth > 0 && (
        <ColorField
          label="Stroke colour"
          value={layer.strokeColor}
          disabled={layer.locked}
          onChange={(value) => patch({ strokeColor: value }, "Stroke colour", `sc:${layer.id}`)}
        />
      )}

      {layer.shape === "rectangle" && (
        <SliderField
          label="Corner radius"
          value={layer.cornerRadius}
          min={0}
          max={Math.round(Math.min(layer.width, layer.height) / 2)}
          neutral={0}
          unit="px"
          disabled={layer.locked}
          onChange={(value) => patch({ cornerRadius: value }, "Corner radius", `cr:${layer.id}`)}
        />
      )}

      {(layer.shape === "polygon" || layer.shape === "star") && (
        <SliderField
          label={layer.shape === "star" ? "Points" : "Sides"}
          value={layer.sides}
          min={3}
          max={24}
          neutral={layer.shape === "star" ? 5 : 6}
          disabled={layer.locked}
          onChange={(value) => patch({ sides: value }, "Shape sides", `sides:${layer.id}`)}
        />
      )}

      {layer.shape === "star" && (
        <SliderField
          label="Inner radius"
          value={Math.round(layer.innerRadius * 100)}
          min={5}
          max={95}
          neutral={45}
          unit="%"
          disabled={layer.locked}
          onChange={(value) => patch({ innerRadius: value / 100 }, "Inner radius", `ir:${layer.id}`)}
        />
      )}

      {layer.shape === "arrow" && (
        <SliderField
          label="Head size"
          value={Math.round(layer.arrowHeadSize * 100)}
          min={5}
          max={80}
          neutral={25}
          unit="%"
          disabled={layer.locked}
          onChange={(value) => patch({ arrowHeadSize: value / 100 }, "Arrow head", `ah:${layer.id}`)}
        />
      )}
    </PanelSection>
  );
}

/* -------------------------------------------------------------------------- */
/* Document                                                                   */
/* -------------------------------------------------------------------------- */

function DocumentProperties({
  document: doc,
  dispatch,
  onResizeCanvas,
}: {
  document: EditorDocument;
  dispatch: (action: EditorAction) => void;
  onResizeCanvas: () => void;
}) {
  return (
    <PanelSection title="Canvas">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Nothing selected. Click a layer on the canvas or in the layers list to edit it.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Width" value={doc.width} suffix="px" onChange={() => onResizeCanvas()} />
        <NumberField label="Height" value={doc.height} suffix="px" onChange={() => onResizeCanvas()} />
      </div>

      <button
        type="button"
        onClick={onResizeCanvas}
        className="w-full rounded-lg border border-border/60 px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
      >
        Resize canvas…
      </button>

      <ColorField
        label="Background"
        value={doc.background ?? "transparent"}
        allowNone
        onChange={(value) =>
          dispatch({
            type: "commit",
            document: { ...doc, background: value === "transparent" ? null : value },
            label: "Canvas background",
            mergeKey: "background",
          })
        }
      />

      <SelectField
        label="Preset"
        value=""
        options={[
          { value: "", label: "Choose a preset…" },
          ...CANVAS_PRESETS.map((preset) => ({
            value: `${preset.width}x${preset.height}`,
            label: `${preset.label}`,
          })),
        ]}
        onChange={(value) => {
          if (!value) return;
          const [width, height] = value.split("x").map(Number);
          dispatch({
            type: "commit",
            document: { ...doc, width, height },
            label: "Resize canvas",
          });
        }}
      />
    </PanelSection>
  );
}

"use client";

/**
 * Reusable SVG charts for the FinancePilot workspace.
 *
 * The platform does not pull a charting library, so every chart here
 * is drawn by hand from the calculator's `FinanceChartSeries`. Two
 * shapes are supported:
 *
 *  - `<LineChart>` for SIP growth and compound-interest growth. A
 *    multi-series line chart with axes and a baseline at the bottom
 *    of the chart area.
 *  - `<PieChart>` for EMI / loan principal-versus-interest. A simple
 *    two-slice pie with a centred legend.
 *
 * Both charts use the LaunchStack colour palette so they fit the
 * rest of the workspace without bespoke styling.
 */

import * as React from "react";
import { useMemo } from "react";
import type { FinanceChartSeries } from "@/lib/financepilot";
import { cn } from "@/lib/utils";

/** A muted palette that reads well on the card background. */
const SERIES_PALETTE = [
  "var(--foreground)",
  "var(--muted-foreground)",
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
] as const;

/** Picks a palette colour for the series at the given index. */
function colorFor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length]!;
}

interface LineChartProps {
  series: FinanceChartSeries[];
  /** Total height in CSS pixels. */
  height?: number;
  /** Optional accessible label. */
  ariaLabel?: string;
}

/**
 * A multi-series line chart. Each series is drawn in its own colour;
 * the first series is filled with a translucent area so the
 * "balance over time" shape reads clearly.
 */
export function LineChart({
  series,
  height = 180,
  ariaLabel,
}: LineChartProps) {
  const { points, viewBox, maxValue } = useMemo(
    () => buildLineGeometry(series),
    [series]
  );
  if (series.length === 0 || points.length === 0) {
    return (
      <div
        className="flex h-32 items-center justify-center text-xs text-muted-foreground"
        style={{ height }}
        aria-label={ariaLabel}
      >
        No data yet
      </div>
    );
  }
  const width = 320;
  const padding = { top: 12, right: 12, bottom: 20, left: 40 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? "Line chart"}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
    >
      <g transform={`translate(${padding.left} ${padding.top})`}>
        {buildGrid(innerWidth, innerHeight, maxValue)}
        {points.map((entry, seriesIndex) => {
          const path = entry.path;
          const areaPath = `${path} L ${entry.lastX} ${innerHeight} L ${entry.firstX} ${innerHeight} Z`;
          const stroke = colorFor(seriesIndex);
          return (
            <g key={entry.name}>
              {seriesIndex === 0 && (
                <path
                  d={areaPath}
                  fill={stroke}
                  fillOpacity={0.08}
                  stroke="none"
                />
              )}
              <path
                d={path}
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {entry.values.map((value, pointIndex) => {
                if (pointIndex % Math.ceil(entry.values.length / 6) !== 0) {
                  return null;
                }
                return (
                  <circle
                    key={pointIndex}
                    cx={value.x}
                    cy={value.y}
                    r={2.5}
                    fill={stroke}
                  />
                );
              })}
            </g>
          );
        })}
        {buildXAxisLabels(
          points[0]!.values,
          innerWidth,
          innerHeight,
          maxValue
        )}
      </g>
    </svg>
  );
}

interface LineGeometry {
  viewBox: string;
  maxValue: number;
  points: Array<{
    name: string;
    path: string;
    firstX: number;
    lastX: number;
    values: Array<{ x: number; y: number; label: string; value: number }>;
  }>;
}

function buildLineGeometry(series: FinanceChartSeries[]): {
  points: LineGeometry["points"];
  viewBox: string;
  maxValue: number;
} {
  const innerWidth = 268;
  const innerHeight = 148;
  const all = series.flatMap((entry) => entry.points.map((p) => p.value));
  const maxValue = all.length === 0 ? 1 : Math.max(...all, 1);
  const points: LineGeometry["points"] = series.map((entry) => {
    const len = entry.points.length;
    const values = entry.points.map((p, index) => {
      const x =
        len <= 1 ? innerWidth / 2 : (innerWidth * index) / (len - 1);
      const y = innerHeight - (innerHeight * p.value) / Math.max(1, maxValue);
      return { x, y, label: p.label, value: p.value };
    });
    const path =
      values.length === 0
        ? ""
        : values
            .map((value, index) =>
              index === 0
                ? `M ${value.x.toFixed(2)} ${value.y.toFixed(2)}`
                : `L ${value.x.toFixed(2)} ${value.y.toFixed(2)}`
            )
            .join(" ");
    return {
      name: entry.name,
      path,
      firstX: values[0]?.x ?? 0,
      lastX: values[values.length - 1]?.x ?? 0,
      values,
    };
  });
  return {
    points,
    viewBox: `0 0 320 180`,
    maxValue,
  };
}

function buildGrid(
  width: number,
  height: number,
  maxValue: number
): React.ReactElement {
  const lines = [];
  const step = maxValue / 4;
  for (let i = 0; i <= 4; i++) {
    const y = height - (height * i) / 4;
    lines.push(
      <line
        key={`grid-${i}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke="var(--border)"
        strokeWidth={0.5}
        strokeDasharray={i === 0 ? "0" : "2 2"}
      />
    );
  }
  return <g aria-hidden="true">{lines}</g>;
}

function buildXAxisLabels(
  values: Array<{ x: number; y: number; label: string; value: number }>,
  _width: number,
  height: number,
  maxValue: number
): React.ReactElement {
  if (values.length === 0) return <g />;
  const ticks = values.filter(
    (_, index) => index % Math.ceil(values.length / 5) === 0
  );
  return (
    <g>
      {ticks.map((tick) => (
        <g key={tick.label}>
          <line
            x1={tick.x}
            y1={height}
            x2={tick.x}
            y2={height + 4}
            stroke="var(--muted-foreground)"
            strokeWidth={0.5}
          />
          <text
            x={tick.x}
            y={height + 14}
            textAnchor="middle"
            fontSize={9}
            fill="var(--muted-foreground)"
            fontFamily="ui-monospace, SFMono-Regular, monospace"
          >
            {tick.label}
          </text>
        </g>
      ))}
      <text
        x={0}
        y={-4}
        textAnchor="start"
        fontSize={9}
        fill="var(--muted-foreground)"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {formatTickValue(maxValue)}
      </text>
      <text
        x={0}
        y={height + 2}
        textAnchor="start"
        fontSize={9}
        fill="var(--muted-foreground)"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        0
      </text>
    </g>
  );
}

function formatTickValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value >= 1_00_00_000) return `${Math.round(value / 1_00_00_000)}Cr`;
  if (value >= 1_00_000) return `${Math.round(value / 1_00_000)}L`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return Math.round(value).toString();
}

interface PieChartProps {
  /** Two-slice pie. Slices are drawn in the order they appear. */
  slices: Array<{ label: string; value: number }>;
  /** Optional diameter in CSS pixels. */
  size?: number;
  ariaLabel?: string;
}

/**
 * A two-slice pie chart drawn as SVG arcs. The legend sits to the
 * right of the pie so the visual is self-explanatory.
 */
export function PieChart({ slices, size = 160, ariaLabel }: PieChartProps) {
  const total = slices.reduce((acc, slice) => acc + Math.max(0, slice.value), 0);
  if (total <= 0) {
    return (
      <div
        className="flex h-32 items-center justify-center text-xs text-muted-foreground"
        aria-label={ariaLabel}
      >
        No data yet
      </div>
    );
  }
  const radius = size / 2;
  const cx = radius;
  const cy = radius;
  return (
    <div className="flex items-center gap-4">
      <svg
        role="img"
        aria-label={ariaLabel ?? "Pie chart"}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
      >
        {slices.map((slice, index) => {
          const start = slices
            .slice(0, index)
            .reduce((acc, s) => acc + s.value, 0);
          const fraction = slice.value / total;
          const startAngle = (start / total) * 2 * Math.PI - Math.PI / 2;
          const endAngle = startAngle + fraction * 2 * Math.PI;
          const x1 = cx + radius * Math.cos(startAngle);
          const y1 = cy + radius * Math.sin(startAngle);
          const x2 = cx + radius * Math.cos(endAngle);
          const y2 = cy + radius * Math.sin(endAngle);
          const largeArc = fraction > 0.5 ? 1 : 0;
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          return (
            <path
              key={slice.label}
              d={d}
              fill={colorFor(index)}
              stroke="var(--card)"
              strokeWidth={2}
            />
          );
        })}
      </svg>
      <ul className="space-y-1.5 text-xs">
        {slices.map((slice, index) => (
          <li
            key={slice.label}
            className="flex items-center gap-2"
            aria-label={`${slice.label}: ${((slice.value / total) * 100).toFixed(1)}%`}
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: colorFor(index) }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{slice.label}</span>
            <span className="font-mono tabular-nums">
              {((slice.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A pill that renders the legend for a multi-series line chart. */
export function ChartLegend({
  series,
  className,
}: {
  series: FinanceChartSeries[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-3 text-xs", className)}>
      {series.map((entry, index) => (
        <li
          key={entry.name}
          className="flex items-center gap-1.5"
          aria-label={entry.name}
        >
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: colorFor(index) }}
            aria-hidden="true"
          />
          <span className="text-muted-foreground">{entry.name}</span>
        </li>
      ))}
    </ul>
  );
}

interface BarChartProps {
  series: FinanceChartSeries[];
  height?: number;
  ariaLabel?: string;
}

/**
 * A multi-series bar chart. Each series renders as a row of bars
 * stacked horizontally with the same x-axis. Used by the goal
 * planner's progress chart and any future module that needs to
 * compare values across categories.
 */
export function BarChart({ series, height = 200, ariaLabel }: BarChartProps) {
  const allPoints = series.flatMap((entry) => entry.points);
  if (series.length === 0 || allPoints.length === 0) {
    return (
      <div
        className="flex h-32 items-center justify-center text-xs text-muted-foreground"
        style={{ height }}
        aria-label={ariaLabel}
      >
        No data yet
      </div>
    );
  }
  const labels = Array.from(new Set(allPoints.map((entry) => entry.label)));
  const allValues = allPoints.map((entry) => entry.value);
  const maxValue = Math.max(...allValues, 1);
  const width = 360;
  const padding = { top: 12, right: 12, bottom: 28, left: 48 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const groupCount = labels.length;
  const groupWidth = groupCount === 0 ? innerWidth : innerWidth / groupCount;
  const barGap = 4;
  const barWidth = Math.max(
    2,
    (groupWidth - barGap * (series.length - 1)) / Math.max(1, series.length)
  );
  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? "Bar chart"}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
    >
      <g transform={`translate(${padding.left} ${padding.top})`}>
        {/* Y grid */}
        {Array.from({ length: 5 }, (_, i) => {
          const y = innerHeight - (innerHeight * i) / 4;
          return (
            <line
              key={`grid-${i}`}
              x1={0}
              y1={y}
              x2={innerWidth}
              y2={y}
              stroke="var(--border)"
              strokeWidth={0.5}
              strokeDasharray={i === 0 ? "0" : "2 2"}
            />
          );
        })}
        {/* Bars */}
        {series.map((entry, seriesIndex) =>
          entry.points.map((point) => {
            const groupIndex = labels.indexOf(point.label);
            if (groupIndex < 0) return null;
            const x = groupIndex * groupWidth + seriesIndex * barWidth + barGap / 2;
            const h = innerHeight * (point.value / maxValue);
            const y = innerHeight - h;
            return (
              <rect
                key={`${entry.name}-${point.label}`}
                x={x}
                y={y}
                width={Math.max(0, barWidth - barGap / 2)}
                height={Math.max(0, h)}
                fill={colorFor(seriesIndex)}
                rx={2}
              />
            );
          })
        )}
        {/* X labels */}
        {labels.map((label, index) => (
          <g key={label}>
            <line
              x1={index * groupWidth + groupWidth / 2}
              y1={innerHeight}
              x2={index * groupWidth + groupWidth / 2}
              y2={innerHeight + 4}
              stroke="var(--muted-foreground)"
              strokeWidth={0.5}
            />
            <text
              x={index * groupWidth + groupWidth / 2}
              y={innerHeight + 16}
              textAnchor="middle"
              fontSize={9}
              fill="var(--muted-foreground)"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              {truncate(label, 10)}
            </text>
          </g>
        ))}
        <text
          x={0}
          y={-4}
          textAnchor="start"
          fontSize={9}
          fill="var(--muted-foreground)"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
        >
          {formatTickValue(maxValue)}
        </text>
        <text
          x={0}
          y={innerHeight + 2}
          textAnchor="start"
          fontSize={9}
          fill="var(--muted-foreground)"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
        >
          0
        </text>
      </g>
    </svg>
  );
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

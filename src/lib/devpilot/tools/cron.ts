/**
 * Cron tool.
 *
 * Visual builder for a five-field cron expression. The functions
 * here translate the field values to a human-readable description
 * (e.g. "At 09:30 every Monday") and to a standard cron string.
 *
 * Field ranges follow the common Quartz / Vixie cron conventions:
 * minute (0-59), hour (0-23), day of month (1-31), month (1-12),
 * day of week (0-6, Sunday = 0).
 */

const FIELD_LABELS: Array<{ key: keyof CronFields; label: string; min: number; max: number }> = [
  { key: "minute", label: "Minute", min: 0, max: 59 },
  { key: "hour", label: "Hour", min: 0, max: 23 },
  { key: "dayOfMonth", label: "Day of month", min: 1, max: 31 },
  { key: "month", label: "Month", min: 1, max: 12 },
  { key: "dayOfWeek", label: "Day of week", min: 0, max: 6 },
];

export interface CronFields {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export interface CronDescription {
  ok: boolean;
  expression: string;
  description: string;
  error: string | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Build a cron expression from the five fields. */
export function buildCronExpression(fields: CronFields): string {
  return [fields.minute, fields.hour, fields.dayOfMonth, fields.month, fields.dayOfWeek]
    .map((value) => value.trim() || "*")
    .join(" ");
}

function parseList(value: string, min: number, max: number): { ok: boolean; values: number[]; error: string | null } {
  if (!value || value === "*") {
    return { ok: true, values: [], error: null };
  }
  const tokens = value.split(",").map((token) => token.trim());
  const values = new Set<number>();
  for (const token of tokens) {
    if (token === "") {
      return { ok: false, values: [], error: "Empty token in field" };
    }
    if (token === "*") {
      return { ok: true, values: rangeArray(min, max), error: null };
    }
    const stepMatch = token.match(/^(.+)\/(\d+)$/);
    if (stepMatch) {
      const base = stepMatch[1]!;
      const step = Number(stepMatch[2]);
      if (!Number.isFinite(step) || step <= 0) {
        return { ok: false, values: [], error: `Invalid step in "${token}"` };
      }
      const range = parseRange(base, min, max);
      if (!range.ok) return { ok: false, values: [], error: range.error };
      for (let i = range.start; i <= range.end; i += step) values.add(i);
      continue;
    }
    if (token.includes("-")) {
      const range = parseRange(token, min, max);
      if (!range.ok) return { ok: false, values: [], error: range.error };
      for (let i = range.start; i <= range.end; i += 1) values.add(i);
      continue;
    }
    const num = Number(token);
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
      return { ok: false, values: [], error: `Invalid value "${token}"` };
    }
    if (num < min || num > max) {
      return { ok: false, values: [], error: `Value ${num} out of range ${min}-${max}` };
    }
    values.add(num);
  }
  return { ok: true, values: Array.from(values).sort((a, b) => a - b), error: null };
}

function parseRange(token: string, min: number, max: number): { ok: true; start: number; end: number; error: string | null } | { ok: false; start: number; end: number; error: string } {
  const [startStr, endStr] = token.split("-");
  const start = Number(startStr);
  const end = Number(endStr);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false, start: 0, end: 0, error: `Invalid range "${token}"` };
  }
  if (start < min || start > max || end < min || end > max) {
    return { ok: false, start: 0, end: 0, error: `Range ${start}-${end} out of bounds` };
  }
  if (start > end) {
    return { ok: false, start: 0, end: 0, error: `Range start greater than end` };
  }
  return { ok: true, start, end, error: null };
}

function rangeArray(min: number, max: number): number[] {
  const out: number[] = [];
  for (let i = min; i <= max; i += 1) out.push(i);
  return out;
}

export function describeCron(fields: CronFields): CronDescription {
  const expression = buildCronExpression(fields);
  interface FieldResult {
    ok: boolean;
    values: number[];
    error: string | null;
  }
  const minutes: FieldResult = parseList(fields.minute, FIELD_LABELS[0]!.min, FIELD_LABELS[0]!.max);
  if (!minutes.ok) return { ok: false, expression, description: "", error: minutes.error };
  const hours: FieldResult = parseList(fields.hour, FIELD_LABELS[1]!.min, FIELD_LABELS[1]!.max);
  if (!hours.ok) return { ok: false, expression, description: "", error: hours.error };
  const days: FieldResult = parseList(fields.dayOfMonth, FIELD_LABELS[2]!.min, FIELD_LABELS[2]!.max);
  if (!days.ok) return { ok: false, expression, description: "", error: days.error };
  const months: FieldResult = parseList(fields.month, FIELD_LABELS[3]!.min, FIELD_LABELS[3]!.max);
  if (!months.ok) return { ok: false, expression, description: "", error: months.error };
  const weekdays: FieldResult = parseList(fields.dayOfWeek, FIELD_LABELS[4]!.min, FIELD_LABELS[4]!.max);
  if (!weekdays.ok) return { ok: false, expression, description: "", error: weekdays.error };
  const description = describeCronInternal(
    minutes.values,
    hours.values,
    days.values,
    months.values,
    weekdays.values
  );
  return { ok: true, expression, description, error: null };
}

function joinList(values: number[], labels?: string[]): string {
  if (values.length === 0) return "";
  if (labels) {
    return values.map((value) => labels[value - 1] ?? String(value)).join(", ");
  }
  if (values.length <= 3) return values.join(", ");
  return `${values[0]}-${values[values.length - 1]}`;
}

function joinLabels(values: number[], labels: string[]): string {
  return values.map((value) => labels[value - 1] ?? String(value)).join(", ");
}

function describeCronInternal(
  minutes: number[],
  hours: number[],
  days: number[],
  months: number[],
  weekdays: number[]
): string {
  const isEveryMinute = minutes.length === 0;
  const isEveryHour = hours.length === 0;
  const isEveryDay = days.length === 0;
  const isEveryMonth = months.length === 0;
  const isEveryWeekday = weekdays.length === 0;

  const minutePart = isEveryMinute
    ? "every minute"
    : minutes.length === 1
      ? `at minute ${pad(minutes[0]!)}`
      : `at minutes ${joinList(minutes)}`;

  const hourPart = isEveryHour
    ? "every hour"
    : hours.length === 1
      ? `past ${pad(hours[0]!)}:00`
      : `past hours ${joinList(hours)}`;

  const monthPart = isEveryMonth
    ? ""
    : months.length === 12
      ? "every month"
      : `in ${joinLabels(months, MONTH_NAMES)}`;

  const dayPart = isEveryDay
    ? ""
    : days.length === 31
      ? ""
      : `on day ${joinList(days)} of the month`;

  const weekdayPart = isEveryWeekday
    ? ""
    : weekdays.length === 7
      ? ""
      : weekdays.length === 5 &&
          weekdays.every((d) => d >= 1 && d <= 5)
        ? "on weekdays"
        : `on ${joinLabels(weekdays, DAY_NAMES)}`;

  const parts = [minutePart, hourPart, dayPart, monthPart, weekdayPart].filter((part) => part);
  if (isEveryMinute && isEveryHour && isEveryDay && isEveryMonth && isEveryWeekday) {
    return "Every minute";
  }
  if (isEveryMinute && isEveryHour && !isEveryDay && !isEveryMonth && isEveryWeekday) {
    return `At ${pad(hours[0]!)}:${pad(minutes[0]!)} every day`;
  }
  if (parts.length === 0) return "Never";
  return capitalise(parts.join(" "));
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function capitalise(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const CRON_FIELD_LABELS = FIELD_LABELS;

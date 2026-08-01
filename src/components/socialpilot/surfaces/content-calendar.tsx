"use client";

/**
 * Content Calendar — Batch 2 surface.
 *
 * A planning calendar with monthly, weekly and daily views. Plans
 * are stored on the project body; the surface lets the user create,
 * edit, delete, move and color-label a plan, and filter by platform.
 */

import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { cn } from "@/lib/utils";
import {
  asCalendarBody,
  DEFAULT_CALENDAR_BODY,
  PLAN_COLORS,
  PLAN_PLATFORMS,
  type SocialContentPlan,
} from "@/lib/socialpilot/bodies";
import type { SocialProject } from "@/lib/socialpilot";

interface ContentCalendarProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

const COLOR_CLASSES: Record<SocialContentPlan["color"], string> = {
  primary: "bg-primary/20 text-primary border-primary/30",
  blue: "bg-blue-500/20 text-blue-600 border-blue-500/30 dark:text-blue-300",
  green: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30 dark:text-emerald-300",
  yellow: "bg-amber-500/20 text-amber-700 border-amber-500/30 dark:text-amber-300",
  pink: "bg-pink-500/20 text-pink-600 border-pink-500/30 dark:text-pink-300",
  purple: "bg-violet-500/20 text-violet-600 border-violet-500/30 dark:text-violet-300",
  orange: "bg-orange-500/20 text-orange-600 border-orange-500/30 dark:text-orange-300",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function randomId(): string {
  return `plan-${Math.random().toString(36).slice(2, 10)}`;
}

function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

function isoDate(date: Date): string {
  return startOfDay(date).toISOString();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDay(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function startOfMonth(date: Date): Date {
  const out = startOfDay(date);
  out.setDate(1);
  return out;
}

function endOfMonth(date: Date): Date {
  const out = startOfMonth(date);
  out.setMonth(out.getMonth() + 1);
  out.setMilliseconds(-1);
  return out;
}

function startOfWeek(date: Date): Date {
  const out = startOfDay(date);
  // Week starts on Sunday; locale-aware would be a future improvement.
  out.setDate(out.getDate() - out.getDay());
  return out;
}

export function ContentCalendar({ project, onChange }: ContentCalendarProps) {
  const body = asCalendarBody(project.body);
  const { toast } = useToast();
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [editing, setEditing] = useState<SocialContentPlan | null>(null);
  const [search, setSearch] = useState("");

  function commit(next: typeof body) {
    onChange({ ...project, body: next });
  }

  function setView(view: typeof body.view) {
    commit({ ...body, view });
  }

  function setPlatformFilter(platform: string) {
    commit({ ...body, platform });
  }

  function addPlan(date: Date) {
    const plan: SocialContentPlan = {
      id: randomId(),
      title: "Untitled plan",
      platform: PLAN_PLATFORMS[0]!,
      date: isoDate(date),
      time: "09:00",
      notes: "",
      color: "primary",
      published: false,
    };
    commit({ ...body, plans: [...body.plans, plan] });
    setEditing(plan);
  }

  function updatePlan(plan: SocialContentPlan) {
    commit({
      ...body,
      plans: body.plans.map((entry) => (entry.id === plan.id ? plan : entry)),
    });
  }

  function deletePlan(plan: SocialContentPlan) {
    commit({ ...body, plans: body.plans.filter((entry) => entry.id !== plan.id) });
    if (editing?.id === plan.id) setEditing(null);
    toast({ message: "Plan deleted", tone: "info" });
  }

  function movePlan(plan: SocialContentPlan, days: number) {
    const next = new Date(plan.date);
    next.setDate(next.getDate() + days);
    updatePlan({ ...plan, date: isoDate(next) });
  }

  const filtered = !body.platform
    ? body.plans
    : body.plans.filter((plan) => plan.platform === body.platform);

  const filteredBySearch = !search
    ? filtered
    : filtered.filter(
        (plan) =>
          plan.title.toLowerCase().includes(search.toLowerCase()) ||
          plan.platform.toLowerCase().includes(search.toLowerCase()) ||
          plan.notes.toLowerCase().includes(search.toLowerCase())
      );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  const next = new Date(cursor);
                  if (body.view === "month") next.setMonth(next.getMonth() - 1);
                  else if (body.view === "week") next.setDate(next.getDate() - 7);
                  else next.setDate(next.getDate() - 1);
                  setCursor(next);
                }}
                aria-label="Previous"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <p className="text-sm font-semibold">
                {body.view === "month"
                  ? formatMonth(cursor)
                  : body.view === "week"
                    ? `Week of ${formatDate(startOfWeek(cursor))}`
                    : formatDate(cursor)}
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  const next = new Date(cursor);
                  if (body.view === "month") next.setMonth(next.getMonth() + 1);
                  else if (body.view === "week") next.setDate(next.getDate() + 7);
                  else next.setDate(next.getDate() + 1);
                  setCursor(next);
                }}
                aria-label="Next"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setCursor(new Date())}
              >
                Today
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {(["month", "week", "day"] as const).map((view) => (
                <button
                  type="button"
                  key={view}
                  onClick={() => setView(view)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                    body.view === view
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  aria-pressed={body.view === view}
                >
                  {view === "month" ? "Month" : view === "week" ? "Week" : "Day"}
                </button>
              ))}
              <select
                value={body.platform}
                onChange={(event) => setPlatformFilter(event.target.value)}
                className="ml-2 h-7 rounded border border-border bg-background px-2 text-[10px]"
                aria-label="Filter by platform"
              >
                <option value="">All platforms</option>
                {PLAN_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {body.view === "month" && (
          <MonthView
            cursor={cursor}
            plans={filteredBySearch}
            onAdd={addPlan}
            onEdit={setEditing}
            onMove={movePlan}
          />
        )}
        {body.view === "week" && (
          <WeekView
            cursor={cursor}
            plans={filteredBySearch}
            onAdd={addPlan}
            onEdit={setEditing}
            onMove={movePlan}
          />
        )}
        {body.view === "day" && (
          <DayView
            cursor={cursor}
            plans={filteredBySearch}
            onAdd={addPlan}
            onEdit={setEditing}
          />
        )}
      </div>
      <div className="space-y-4">
        <Card className="p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            All plans
          </div>
          <div className="relative">
            <Search
              className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plans"
              className="h-7 pl-7 text-xs"
              aria-label="Search plans"
            />
          </div>
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
            {filteredBySearch.length === 0 ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                No plans yet
              </li>
            ) : (
              filteredBySearch
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((plan) => (
                  <li key={plan.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(plan)}
                      className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full",
                          plan.color === "primary" && "bg-primary",
                          plan.color === "blue" && "bg-blue-500",
                          plan.color === "green" && "bg-emerald-500",
                          plan.color === "yellow" && "bg-amber-500",
                          plan.color === "pink" && "bg-pink-500",
                          plan.color === "purple" && "bg-violet-500",
                          plan.color === "orange" && "bg-orange-500"
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {plan.title}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {new Date(plan.date).toLocaleDateString()} ·{" "}
                          {plan.time || "—"} · {plan.platform}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
            )}
          </ul>
        </Card>
        <Card className="p-3 text-xs text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Tip:</strong>{" "}
            the calendar is a planning surface, not a scheduler. Click a
            day to add a plan, click a plan to edit it, and use the
            platform filter to focus on one channel at a time.
          </p>
        </Card>
      </div>
      {editing && (
        <PlanEditor
          plan={editing}
          onChange={updatePlan}
          onDelete={deletePlan}
          onClose={() => setEditing(null)}
          onMove={movePlan}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Views                                                                      */
/* -------------------------------------------------------------------------- */

interface ViewProps {
  cursor: Date;
  plans: SocialContentPlan[];
  onAdd: (date: Date) => void;
  onEdit: (plan: SocialContentPlan) => void;
  onMove?: (plan: SocialContentPlan, days: number) => void;
}

function MonthView({ cursor, plans, onAdd, onEdit, onMove }: ViewProps) {
  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  const startWeek = startOfWeek(start);
  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(startWeek);
    day.setDate(day.getDate() + i);
    days.push(day);
    if (day > end && day.getDay() === 6) break;
  }
  const plansByDay = groupByDay(plans);
  return (
    <Card className="p-2">
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = isoDate(day);
          const dayPlans = plansByDay.get(iso) ?? [];
          const inMonth = day.getMonth() === cursor.getMonth();
          return (
            <button
              type="button"
              key={iso}
              onClick={() => onAdd(day)}
              className={cn(
                "flex h-24 flex-col items-start gap-1 rounded border border-border p-1 text-left text-[10px] hover:bg-accent",
                !inMonth && "opacity-50"
              )}
              aria-label={`Add plan on ${formatDate(day)}`}
            >
              <span className="font-medium tabular-nums">{day.getDate()}</span>
              <ul className="w-full space-y-0.5">
                {dayPlans.slice(0, 3).map((plan) => (
                  <li
                    key={plan.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(plan);
                    }}
                    className={cn(
                      "flex items-center gap-1 truncate rounded border px-1 py-0.5",
                      COLOR_CLASSES[plan.color]
                    )}
                  >
                    <span className="truncate">{plan.title}</span>
                  </li>
                ))}
                {dayPlans.length > 3 && (
                  <li className="text-[9px] text-muted-foreground">
                    +{dayPlans.length - 3} more
                  </li>
                )}
              </ul>
            </button>
          );
        })}
      </div>
      {onMove && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Tip: open a plan to move it forward or back by ±1 day.
        </p>
      )}
    </Card>
  );
}

function WeekView({ cursor, plans, onAdd, onEdit, onMove }: ViewProps) {
  const start = startOfWeek(cursor);
  const days: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    days.push(day);
  }
  const plansByDay = groupByDay(plans);
  return (
    <Card className="p-2">
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = isoDate(day);
          const dayPlans = plansByDay.get(iso) ?? [];
          return (
            <button
              type="button"
              key={iso}
              onClick={() => onAdd(day)}
              className="flex h-64 flex-col items-stretch gap-1 rounded border border-border p-1 text-left text-[10px] hover:bg-accent"
              aria-label={`Add plan on ${formatDate(day)}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{formatDay(day)}</span>
                <span className="text-muted-foreground">{day.getDate()}</span>
              </div>
              <ul className="space-y-0.5">
                {dayPlans.map((plan) => (
                  <li
                    key={plan.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(plan);
                    }}
                    className={cn(
                      "truncate rounded border px-1 py-0.5",
                      COLOR_CLASSES[plan.color]
                    )}
                  >
                    {plan.time ? `${plan.time} ` : ""}
                    {plan.title}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      {onMove && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Tip: open a plan to move it forward or back by ±1 day.
        </p>
      )}
    </Card>
  );
}

function DayView({ cursor, plans, onAdd, onEdit }: ViewProps) {
  const iso = isoDate(cursor);
  const dayPlans = plans
    .filter((plan) => plan.date === iso)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">{formatDate(cursor)}</p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => onAdd(cursor)}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add plan
        </Button>
      </div>
      {dayPlans.length === 0 ? (
        <p className="text-xs text-muted-foreground">No plans for this day</p>
      ) : (
        <ul className="space-y-1">
          {dayPlans.map((plan) => (
            <li
              key={plan.id}
              className={cn(
                "flex items-center gap-2 rounded border px-2 py-1 text-xs",
                COLOR_CLASSES[plan.color]
              )}
            >
              <span className="w-12 tabular-nums">{plan.time || "—"}</span>
              <span className="flex-1 truncate">{plan.title}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1 text-[10px]"
                onClick={() => onEdit(plan)}
              >
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function groupByDay(plans: SocialContentPlan[]): Map<string, SocialContentPlan[]> {
  const out = new Map<string, SocialContentPlan[]>();
  for (const plan of plans) {
    const arr = out.get(plan.date) ?? [];
    arr.push(plan);
    out.set(plan.date, arr);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Plan editor                                                                */
/* -------------------------------------------------------------------------- */

function PlanEditor({
  plan,
  onChange,
  onDelete,
  onClose,
  onMove,
}: {
  plan: SocialContentPlan;
  onChange: (next: SocialContentPlan) => void;
  onDelete: (next: SocialContentPlan) => void;
  onClose: () => void;
  onMove: (next: SocialContentPlan, days: number) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Edit plan</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Title</span>
            <Input
              value={plan.title}
              onChange={(event) => onChange({ ...plan, title: event.target.value })}
              className="h-8 text-sm"
              aria-label="Title"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Platform</span>
              <select
                value={plan.platform}
                onChange={(event) =>
                  onChange({ ...plan, platform: event.target.value })
                }
                className="h-8 rounded border border-border bg-background px-2 text-sm"
                aria-label="Platform"
              >
                {PLAN_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Time</span>
              <Input
                type="time"
                value={plan.time}
                onChange={(event) => onChange({ ...plan, time: event.target.value })}
                className="h-8 text-sm"
                aria-label="Time"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Date</span>
              <Input
                type="date"
                value={plan.date.slice(0, 10)}
                onChange={(event) => {
                  if (!event.target.value) return;
                  const next = new Date(event.target.value);
                  onChange({ ...plan, date: isoDate(next) });
                }}
                className="h-8 text-sm"
                aria-label="Date"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Color</span>
              <div className="flex flex-wrap gap-1">
                {PLAN_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => onChange({ ...plan, color })}
                    className={cn(
                      "h-6 w-6 rounded-full border",
                      plan.color === color
                        ? "ring-2 ring-foreground"
                        : "border-border",
                      color === "primary" && "bg-primary",
                      color === "blue" && "bg-blue-500",
                      color === "green" && "bg-emerald-500",
                      color === "yellow" && "bg-amber-500",
                      color === "pink" && "bg-pink-500",
                      color === "purple" && "bg-violet-500",
                      color === "orange" && "bg-orange-500"
                    )}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Notes</span>
            <textarea
              value={plan.notes}
              onChange={(event) => onChange({ ...plan, notes: event.target.value })}
              rows={3}
              className="rounded border border-border bg-background p-2 text-sm"
              aria-label="Notes"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={plan.published}
              onChange={(event) =>
                onChange({ ...plan, published: event.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            <span className="font-medium">Published</span>
          </label>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onMove(plan, -1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Move 1 day back
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onMove(plan, 1)}
            >
              Move 1 day forward
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => onDelete(plan)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </Button>
          <Button
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

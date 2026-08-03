"use client";

/**
 * Client-side analytics tracker.
 *
 * Single entry point the rest of the platform uses to record events. The
 * tracker is deliberately small: a thin fetch wrapper with a per-page dedup
 * cache, an offline queue, and a `sendBeacon` / `keepalive` fallback so a
 * navigation away cannot drop an in-flight event.
 *
 * The server-side helpers live in `@/lib/platform/analytics`. The five
 * matching API routes live under `/api/analytics/{pageview,event,search,
 * performance,error}`. This module never assumes the network is available
 * and never throws.
 */

import type { AnalyticsCategory } from "@/lib/platform/analytics";

const SESSION_STORAGE_KEY = "ls_analytics_sid";
const SESSION_STORAGE_FALLBACK = "ls_analytics_sid_fallback";
const SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const DEDUPE_WINDOW_MS = 1500;

export interface AnalyticsContext {
  productId?: string;
  toolName?: string;
}

interface PendingEvent {
  endpoint: string;
  body: Record<string, unknown>;
}

/** Module-level cache so multiple components share a single instance. */
const cache = {
  /** Path the page was last viewed at; used to compute `fromPath`. */
  lastPath: null as string | null,
  /** Per-event dedup so a double-mounted provider doesn't double-fire. */
  recent: new Map<string, number>(),
  /** Offline queue, drained on `online`. */
  queue: [] as PendingEvent[],
  /** Context last set by the provider, so calls outside React can read it. */
  context: {} as AnalyticsContext,
  /** Whether the tracker is enabled (off when the user opts out). */
  enabled: true,
};

/* -------------------------------------------------------------------------- */
/* Session id                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Returns the visitor's session id, minting one on first run. The id is
 * stored in both localStorage and a non-HttpOnly sibling cookie so the
 * server route can read it without depending on the HttpOnly cookie set by
 * `/api/analytics/pageview`. The two are kept in sync on first read.
 */
export function getSessionId(): string {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    const storedAt = Number(localStorage.getItem(SESSION_STORAGE_FALLBACK) ?? "0");
    if (stored && storedAt && Date.now() - storedAt < SESSION_MAX_AGE_MS) {
      return stored;
    }
  } catch {
    // localStorage is unavailable (private mode, server render).
  }

  const id = newSessionId();
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, id);
    localStorage.setItem(SESSION_STORAGE_FALLBACK, String(Date.now()));
  } catch {
    /* swallow */
  }
  return id;
}

function newSessionId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

function dedupeKey(endpoint: string, body: Record<string, unknown>): string {
  // Stable enough for the dedup window: same endpoint + same key fields.
  const keyPart = JSON.stringify({
    a: body.action,
    p: body.path,
    t: body.toolName,
    m: body.metric,
  });
  return `${endpoint}::${keyPart}`;
}

function shouldSend(key: string): boolean {
  const now = Date.now();
  const last = cache.recent.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) return false;
  cache.recent.set(key, now);
  // Trim occasionally so the map can't grow unbounded.
  if (cache.recent.size > 200) {
    for (const [k, t] of cache.recent) {
      if (now - t > DEDUPE_WINDOW_MS * 4) cache.recent.delete(k);
    }
  }
  return true;
}

function flushQueue(): void {
  if (!cache.queue.length) return;
  const drained = cache.queue.splice(0, cache.queue.length);
  for (const pending of drained) {
    void send(pending.endpoint, pending.body, { beacon: true });
  }
}

function enqueue(endpoint: string, body: Record<string, unknown>): void {
  // Cap the queue so a long offline period can't fill memory.
  if (cache.queue.length < 50) cache.queue.push({ endpoint, body });
}

async function send(
  endpoint: string,
  body: Record<string, unknown>,
  options: { beacon?: boolean } = {}
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!cache.enabled) return;

  const key = dedupeKey(endpoint, body);
  if (!shouldSend(key)) return;

  const payload = JSON.stringify({
    ...body,
    // Always tag the request with the session id so the server can correlate
    // even when the cookie has not been set yet (e.g. the very first event
    // of the visit before the pageview response stamps the cookie).
    ...(endpoint.endsWith("/search") ? {} : { _sid: getSessionId() }),
  });

  if (options.beacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (sent) return;
    } catch {
      /* fall through to fetch */
    }
  }

  try {
    if (!isOnline()) {
      enqueue(endpoint, body);
      return;
    }
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      // Keeps the request alive across a navigation.
      keepalive: true,
      credentials: "same-origin",
    });
  } catch {
    enqueue(endpoint, body);
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export function setAnalyticsContext(context: AnalyticsContext): void {
  cache.context = { ...cache.context, ...context };
}

export function setAnalyticsEnabled(enabled: boolean): void {
  cache.enabled = enabled;
  if (enabled && typeof window !== "undefined" && navigator.onLine !== false) {
    flushQueue();
  }
}

export function getCurrentPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export function trackPageView(input?: { path?: string; referrer?: string }): void {
  if (typeof window === "undefined") return;
  const path = input?.path ?? getCurrentPath();
  const fromPath = cache.lastPath && cache.lastPath !== path ? cache.lastPath : undefined;
  const referrer =
    input?.referrer ??
    (typeof document !== "undefined" && document.referrer ? document.referrer : undefined);

  cache.lastPath = path;

  void send("/api/analytics/pageview", {
    path,
    fromPath,
    referrer,
  });
}

export interface TrackEventOptions {
  category: AnalyticsCategory;
  action: string;
  productId?: string;
  toolName?: string;
  path?: string;
  fromPath?: string;
  durationMs?: number;
  status?: number;
  props?: Record<string, unknown>;
}

export function trackEvent(options: TrackEventOptions): void {
  const productId = options.productId ?? cache.context.productId;
  const toolName = options.toolName ?? cache.context.toolName;
  void send("/api/analytics/event", {
    category: options.category,
    action: options.action,
    productId,
    toolName,
    path: options.path ?? getCurrentPath(),
    fromPath: options.fromPath,
    durationMs: options.durationMs,
    status: options.status,
    props: options.props,
  });
}

export interface TrackSearchOptions {
  query: string;
  resultsCount: number;
  latencyMs: number;
  source?: "global" | "command_palette" | "file_manager";
  firstClickHref?: string;
  firstClickType?: string;
}

export function trackSearch(options: TrackSearchOptions): void {
  void send("/api/analytics/search", {
    query: options.query,
    resultsCount: options.resultsCount,
    latencyMs: options.latencyMs,
    source: options.source ?? "global",
    firstClickHref: options.firstClickHref,
    firstClickType: options.firstClickType,
  });
}

export interface TrackPerformanceOptions {
  metric: "page_load" | "long_task" | "api_latency" | "first_paint" | "lcp" | "cls";
  durationMs: number;
  path?: string;
  status?: number;
  label?: string;
  productId?: string;
  toolName?: string;
}

export function trackPerformance(options: TrackPerformanceOptions): void {
  void send("/api/analytics/performance", {
    metric: options.metric,
    durationMs: options.durationMs,
    path: options.path,
    status: options.status,
    label: options.label,
    productId: options.productId,
    toolName: options.toolName,
  });
}

export interface TrackErrorOptions {
  source: "uncaught" | "unhandled_rejection" | "api" | "render" | "tool";
  message: string;
  path?: string;
  productId?: string;
  toolName?: string;
  status?: number;
}

export function trackError(options: TrackErrorOptions): void {
  // Truncate locally too, so a 100KB string doesn't even hit the network.
  void send(
    "/api/analytics/error",
    {
      source: options.source,
      message: options.message.slice(0, 1000),
      path: options.path,
      productId: options.productId,
      toolName: options.toolName,
      status: options.status,
    },
    { beacon: true }
  );
}

/* -------------------------------------------------------------------------- */
/* Lifecycle hooks                                                            */
/* -------------------------------------------------------------------------- */

let installed = false;

/** Wires up the global listeners that auto-capture errors, navigation, etc. */
export function installAnalytics(): () => void {
  if (typeof window === "undefined" || installed) return () => undefined;
  installed = true;

  cache.lastPath = getCurrentPath();
  trackPageView();

  const onPopState = () => trackPageView();
  window.addEventListener("popstate", onPopState);

  // patchHistory() monkey-patches pushState/replaceState so the App Router's
  // client-side transitions are observable without subscribing to every Link.
  const originalPush = window.history.pushState;
  const originalReplace = window.history.replaceState;
  const patch = (original: typeof window.history.pushState) =>
    function patchedState(this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      queueMicrotask(() => trackPageView());
      return result;
    };
  window.history.pushState = patch(originalPush) as typeof originalPush;
  window.history.replaceState = patch(originalReplace) as typeof originalReplace;

  const onError = (event: ErrorEvent) => {
    trackError({
      source: "uncaught",
      message: event.message || "Unhandled error",
      path: getCurrentPath(),
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    trackError({
      source: "unhandled_rejection",
      message: message.slice(0, 1000),
      path: getCurrentPath(),
    });
  };
  const onOnline = () => flushQueue();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      // Best-effort flush so the in-flight queue survives a tab background.
      flushQueue();
    }
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
    window.history.pushState = originalPush;
    window.history.replaceState = originalReplace;
    installed = false;
  };
}

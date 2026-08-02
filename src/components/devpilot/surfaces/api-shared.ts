/**
 * Shared API client helpers used by the API surface.
 *
 * The implementation lives here so the surface file can stay
 * focused on layout. The actual `fetch` call, header / query
 * merging, and history-entry construction are pure functions so
 * they are easy to test.
 */

import type {
  DevApiBody,
  DevApiHeader,
  DevApiHistoryEntry,
  DevApiQueryParam,
  DevApiRequest,
  DevApiResponse,
} from "@/lib/devpilot";
import { DEFAULT_API_BODY, DEFAULT_API_REQUEST, asApiBody } from "@/lib/devpilot";

// Re-export the canonical lib types so the surface and the shared
// module stay in lock-step without duplicating the schema.
export type ApiBody = DevApiBody;
export type HeaderRow = DevApiHeader;
export type ApiHistoryEntry = DevApiHistoryEntry;
export type QueryRow = DevApiQueryParam;
export type ApiRequest = DevApiRequest;
export type ApiResponse = DevApiResponse;
export type RequestMethod = DevApiRequest["method"];

export { asApiBody };

export function defaultApiRequest(): ApiRequest {
  return { ...DEFAULT_API_REQUEST, id: `req-${Math.random().toString(36).slice(2, 10)}` };
}

export function defaultApiBody(): ApiBody {
  return { ...DEFAULT_API_BODY, request: defaultApiRequest() };
}

export function defaultApiHeaders(seed?: string): HeaderRow {
  return {
    id: `hdr-${Math.random().toString(36).slice(2, 10)}`,
    key: seed ?? "Header",
    value: "",
    enabled: true,
  };
}

export function defaultApiQuery(seed?: string): QueryRow {
  return {
    id: `q-${Math.random().toString(36).slice(2, 10)}`,
    key: seed ?? "param",
    value: "",
    enabled: true,
  };
}

export function randomApiId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function applyQuery(url: string, params: QueryRow[]): string {
  const enabled = params.filter((param) => param.enabled && param.key.trim());
  if (enabled.length === 0) return url;
  const search = new URLSearchParams();
  for (const param of enabled) {
    search.append(param.key, param.value);
  }
  const [base, hash] = url.split("#", 2);
  const separator = base!.includes("?") ? "&" : "?";
  const tail = search.toString();
  return `${base}${separator}${tail}${hash ? `#${hash}` : ""}`;
}

function applyHeaders(headers: HeaderRow[]): Headers {
  const out = new Headers();
  for (const header of headers) {
    if (header.enabled && header.key.trim()) {
      out.append(header.key, header.value);
    }
  }
  return out;
}

export interface DispatchOptions {
  request: ApiRequest;
}

export interface DispatchResult {
  ok: boolean;
  response: ApiResponse;
  historyEntry: ApiHistoryEntry;
}

export async function dispatchRequest(options: DispatchOptions): Promise<DispatchResult> {
  const { request } = options;
  const url = applyQuery(request.url, request.query);
  const headers = applyHeaders(request.headers);
  const method = request.method;
  const body =
    method === "GET" || method === "DELETE" || !request.body.trim()
      ? undefined
      : request.body;

  const started = performance.now();
  let response: Response | null = null;
  let error: string | null = null;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      redirect: "follow",
      referrerPolicy: "no-referrer",
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Network request failed";
  }
  const elapsedMs = Math.round(performance.now() - started);

  if (!response) {
    const failed: ApiResponse = {
      status: 0,
      statusText: "",
      headers: [],
      body: "",
      size: 0,
      elapsedMs,
      failed: true,
      error,
    };
    return {
      ok: false,
      response: failed,
      historyEntry: {
        id: randomApiId("apihist"),
        method,
        url,
        status: 0,
        failed: true,
        elapsedMs,
        isFavorite: false,
        collection: "",
        createdAt: new Date().toISOString(),
      },
    };
  }

  const headerEntries: Array<{ key: string; value: string }> = [];
  response.headers.forEach((value, key) => {
    headerEntries.push({ key, value });
  });
  const bodyText = await response.text();
  const blob = new Blob([bodyText]);
  const size = blob.size;

  const ok: ApiResponse = {
    status: response.status,
    statusText: response.statusText,
    headers: headerEntries,
    body: bodyText,
    size,
    elapsedMs,
    failed: false,
    error: null,
  };
  return {
    ok: true,
    response: ok,
    historyEntry: {
      id: randomApiId("apihist"),
      method,
      url,
      status: response.status,
      failed: false,
      elapsedMs,
      isFavorite: false,
      collection: "",
      createdAt: new Date().toISOString(),
    },
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

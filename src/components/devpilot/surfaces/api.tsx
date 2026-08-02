"use client";

/**
 * API client surface.
 *
 * Builds, sends and inspects a single HTTP request per session. The
 * request and the response are stored on the session body so the
 * autosave loop preserves the user's setup across tabs.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { useRef, useState } from "react";
import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Clock,
  Copy,
  Globe,
  KeyRound,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asApiBody,
  defaultApiHeaders,
  defaultApiQuery,
  dispatchRequest,
  formatBytes,
  formatElapsed,
  randomApiId,
  type ApiBody,
  type ApiHistoryEntry,
  type ApiResponse,
  type HeaderRow,
  type QueryRow,
  type RequestMethod,
} from "./api-shared";
import { copyToClipboard, deleteDevSession, type DevSession } from "@/lib/devpilot";

const METHODS: RequestMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

interface ApiSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

const COLLECTION_PRESETS = ["Smoke", "Auth", "Pagination", "Errors"];

export function ApiSurface({ session, onChange }: ApiSurfaceProps) {
  const body = asApiBody(session.body);
  const { toast } = useToast();
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [sending, setSending] = useState(false);
  const collectionInputRef = useRef<HTMLInputElement | null>(null);

  function commit(patch: Partial<ApiBody>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  function commitRequest(patch: Partial<typeof body.request>) {
    commit({ request: { ...body.request, ...patch } });
  }

  function setMethod(method: RequestMethod) {
    commitRequest({ method });
  }

  function setUrl(url: string) {
    commitRequest({ url });
  }

  function setRequestBody(value: string) {
    commitRequest({ body: value });
  }

  function setContentType(value: string) {
    commitRequest({ contentType: value });
  }

  function setQueryRows(rows: QueryRow[]) {
    commitRequest({ query: rows });
  }

  function setHeaderRows(rows: HeaderRow[]) {
    commitRequest({ headers: rows });
  }

  function updateHeader(id: string, patch: Partial<HeaderRow>) {
    setHeaderRows(body.request.headers.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateQuery(id: string, patch: Partial<QueryRow>) {
    setQueryRows(body.request.query.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addHeader() {
    setHeaderRows([...body.request.headers, defaultApiHeaders("Header")]);
  }

  function addQuery() {
    setQueryRows([...body.request.query, defaultApiQuery("param")]);
  }

  function removeHeader(id: string) {
    setHeaderRows(body.request.headers.filter((row) => row.id !== id));
  }

  function removeQuery(id: string) {
    setQueryRows(body.request.query.filter((row) => row.id !== id));
  }

  function toggleHeader(id: string) {
    updateHeader(id, { enabled: !body.request.headers.find((row) => row.id === id)?.enabled });
  }

  function toggleQuery(id: string) {
    updateQuery(id, { enabled: !body.request.query.find((row) => row.id === id)?.enabled });
  }

  async function send() {
    if (!body.request.url.trim()) {
      toast({ message: "URL is required", tone: "error" });
      return;
    }
    setSending(true);
    try {
      const result = await dispatchRequest({ request: body.request });
      setResponse(result.response);
      const nextHistory = [result.historyEntry, ...body.history].slice(0, 200);
      commit({ history: nextHistory });
      if (result.response.failed) {
        toast({ message: result.response.error ?? "Request failed", tone: "error" });
      } else {
        toast({
          message: `${result.response.status} ${result.response.statusText || ""}`.trim(),
          tone: result.response.status < 400 ? "success" : "error",
        });
      }
    } finally {
      setSending(false);
    }
  }

  function toggleHistoryFavourite(id: string) {
    commit({
      history: body.history.map((entry) =>
        entry.id === id ? { ...entry, isFavorite: !entry.isFavorite } : entry
      ),
    });
  }

  function removeHistoryEntry(id: string) {
    commit({ history: body.history.filter((entry) => entry.id !== id) });
  }

  function clearHistory() {
    commit({ history: [] });
    toast({ message: "History cleared", tone: "info" });
  }

  function addCollection(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (body.collections.includes(trimmed)) return;
    commit({ collections: [...body.collections, trimmed] });
  }

  function replay(entry: ApiHistoryEntry) {
    const matched = body.request;
    setResponse(null);
    setMethod(entry.method);
    setUrl(entry.url);
    setContentType(matched.contentType);
    setRequestBody(matched.body);
    setQueryRows(matched.query);
    setHeaderRows(matched.headers);
  }

  async function copyResponseBody() {
    if (!response) {
      toast({ message: "Send a request first", tone: "info" });
      return;
    }
    const ok = await copyToClipboard(response.body);
    toast({ message: ok ? "Response copied" : "Could not copy", tone: ok ? "success" : "error" });
  }

  const filteredHistory = body.history.filter((entry) => {
    if (body.activeCollection && entry.collection !== body.activeCollection) return false;
    if (body.search) {
      const term = body.search.toLowerCase();
      return entry.url.toLowerCase().includes(term) || entry.method.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Build a request, send it, inspect the response, and keep the history."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={copyResponseBody}
        copyDisabled={!response}
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        extraActions={
          <Button
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => void send()}
            disabled={sending || !body.request.url.trim()}
          >
            {sending ? "Sending…" : "Send"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={body.request.method}
              onChange={(event) => setMethod(event.target.value as RequestMethod)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs font-semibold"
              aria-label="Method"
            >
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <Input
              value={body.request.url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://api.example.com/endpoint"
              className="h-8 flex-1 text-xs"
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Requests run in the browser. The target server must allow CORS for the request to succeed.
          </p>
        </Card>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Query parameters</h3>
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={addQuery}>
                <Plus className="h-3 w-3" aria-hidden="true" />
                Add
              </Button>
            </div>
            {body.request.query.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No query parameters.</p>
            ) : (
              <ul className="space-y-1">
                {body.request.query.map((row) => (
                  <li key={row.id} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={() => toggleQuery(row.id)}
                      className="h-3 w-3"
                      aria-label={`Enable query ${row.key}`}
                    />
                    <Input
                      value={row.key}
                      onChange={(event) => updateQuery(row.id, { key: event.target.value })}
                      placeholder="key"
                      className="h-7 text-xs"
                    />
                    <Input
                      value={row.value}
                      onChange={(event) => updateQuery(row.id, { value: event.target.value })}
                      placeholder="value"
                      className="h-7 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeQuery(row.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`Remove query ${row.key}`}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Headers</h3>
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={addHeader}>
                <Plus className="h-3 w-3" aria-hidden="true" />
                Add
              </Button>
            </div>
            {body.request.headers.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No headers.</p>
            ) : (
              <ul className="space-y-1">
                {body.request.headers.map((row) => (
                  <li key={row.id} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={() => toggleHeader(row.id)}
                      className="h-3 w-3"
                      aria-label={`Enable header ${row.key}`}
                    />
                    <Input
                      value={row.key}
                      onChange={(event) => updateHeader(row.id, { key: event.target.value })}
                      placeholder="name"
                      className="h-7 text-xs"
                    />
                    <Input
                      value={row.value}
                      onChange={(event) => updateHeader(row.id, { value: event.target.value })}
                      placeholder="value"
                      className="h-7 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeHeader(row.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`Remove header ${row.key}`}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {body.request.method !== "GET" && body.request.method !== "DELETE" && (
          <Card className="p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">Request body</h3>
              <Input
                value={body.request.contentType}
                onChange={(event) => setContentType(event.target.value)}
                placeholder="Content-Type"
                className="h-7 w-48 text-xs"
                aria-label="Content type"
              />
            </div>
            <textarea
              value={body.request.body}
              onChange={(event) => setRequestBody(event.target.value)}
              placeholder='{"hello":"world"}'
              spellCheck={false}
              className="min-h-[140px] w-full rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
            />
          </Card>
        )}

        <ResponsePanel
          response={response}
          onCopy={copyResponseBody}
        />

        <Card className="p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold">History</h3>
            <div className="flex items-center gap-1">
              <select
                value={body.activeCollection}
                onChange={(event) => commit({ activeCollection: event.target.value })}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs"
                aria-label="Collection filter"
              >
                <option value="">All collections</option>
                {body.collections.map((collection) => (
                  <option key={collection} value={collection}>
                    {collection}
                  </option>
                ))}
              </select>
              <div className="relative">
                <Search
                  className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={body.search}
                  onChange={(event) => commit({ search: event.target.value })}
                  placeholder="Search history…"
                  className="h-7 w-40 pl-6 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={clearHistory}
                disabled={body.history.length === 0}
              >
                Clear
              </Button>
            </div>
          </div>

          <CollectionsRow
            collections={body.collections}
            onAdd={(value) => addCollection(value)}
            inputRef={collectionInputRef}
          />

          {filteredHistory.length === 0 ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              No history yet — press Send to record a request.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {filteredHistory.slice(0, 20).map((entry) => (
                <HistoryRow
                  key={entry.id}
                  entry={entry}
                  collections={body.collections}
                  onReplay={() => replay(entry)}
                  onFavourite={() => toggleHistoryFavourite(entry.id)}
                  onDelete={() => removeHistoryEntry(entry.id)}
                  onSetCollection={(value) =>
                    commit({
                      history: body.history.map((item) =>
                        item.id === entry.id ? { ...item, collection: value } : item
                      ),
                    })
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

interface CollectionsRowProps {
  collections: string[];
  onAdd: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function CollectionsRow({ collections, onAdd, inputRef }: CollectionsRowProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {COLLECTION_PRESETS.filter((preset) => !collections.includes(preset)).map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onAdd(preset)}
          className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
        >
          + {preset}
        </button>
      ))}
      <Input
        ref={inputRef}
        placeholder="New collection…"
        className="h-6 w-32 text-[10px]"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const value = event.currentTarget.value;
            onAdd(value);
            event.currentTarget.value = "";
          }
        }}
      />
    </div>
  );
}

interface HistoryRowProps {
  entry: ApiHistoryEntry;
  collections: string[];
  onReplay: () => void;
  onFavourite: () => void;
  onDelete: () => void;
  onSetCollection: (value: string) => void;
}

function HistoryRow({ entry, collections, onReplay, onFavourite, onDelete, onSetCollection }: HistoryRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background p-1 text-[11px]">
      <StatusBadge status={entry.status} failed={entry.failed} />
      <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">{entry.method}</span>
      <span className="flex-1 truncate font-mono">{entry.url}</span>
      <span className="text-muted-foreground">{formatElapsed(entry.elapsedMs)}</span>
      <select
        value={entry.collection}
        onChange={(event) => onSetCollection(event.target.value)}
        className="h-6 rounded-md border border-border bg-background px-1 text-[10px]"
        aria-label="Collection"
      >
        <option value="">—</option>
        {collections.map((collection) => (
          <option key={collection} value={collection}>
            {collection}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onReplay}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Replay"
      >
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onFavourite}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={entry.isFavorite ? "Unfavourite" : "Favourite"}
      >
        <Star
          className={
            entry.isFavorite
              ? "h-3 w-3 fill-primary text-primary"
              : "h-3 w-3"
          }
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Delete"
      >
        <Trash2 className="h-3 w-3" aria-hidden="true" />
      </button>
    </li>
  );
}

interface ResponsePanelProps {
  response: ApiResponse | null;
  onCopy: () => void;
}

function ResponsePanel({ response, onCopy }: ResponsePanelProps) {
  if (!response) {
    return (
      <Card className="flex flex-col items-start gap-2 p-3 text-xs text-muted-foreground">
        <span>Press Send to make a request.</span>
        <span className="text-[10px]">
          Every successful response is stored on the session body so the
          autosave loop keeps it across tabs.
        </span>
      </Card>
    );
  }
  return (
    <Card className="p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <StatusBadge status={response.status} failed={response.failed} />
        {response.statusText && <span>{response.statusText}</span>}
        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {formatElapsed(response.elapsedMs)}
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
          <Globe className="h-3 w-3" aria-hidden="true" />
          {formatBytes(response.size)}
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          <KeyRound className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span className="text-[10px] text-muted-foreground">{response.headers.length} response headers</span>
        </span>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={onCopy}>
          <Copy className="h-3 w-3" aria-hidden="true" />
          Copy body
        </Button>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Response headers
          </p>
          <ul className="max-h-[140px] space-y-0.5 overflow-auto rounded border border-border bg-background p-2 font-mono text-[10px]">
            {response.headers.map((header) => (
              <li key={`${header.key}-${header.value}`} className="truncate">
                <span className="font-semibold text-foreground">{header.key}</span>
                <span className="text-muted-foreground">: {header.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Response body
          </p>
          <pre className="max-h-[260px] overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
            {response.body || "(empty)"}
          </pre>
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status, failed }: { status: number; failed: boolean }) {
  if (failed) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
        <CircleX className="h-3 w-3" aria-hidden="true" />
        network
      </span>
    );
  }
  if (status >= 200 && status < 300) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary">
        <CircleCheck className="h-3 w-3" aria-hidden="true" />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
      <CircleX className="h-3 w-3" aria-hidden="true" />
      {status}
    </span>
  );
}

// randomApiId is unused at the surface level but kept exported from the
// shared module so future tool surfaces can import it without re-declaring.
void randomApiId;

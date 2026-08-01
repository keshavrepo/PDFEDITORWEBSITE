"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Layers, Loader2, Search, BookOpen, Newspaper, FilePlus, Clock } from "lucide-react";
import {
  searchTypeLabels,
  searchTypeOrder,
  type SearchResult,
  type SearchResultType,
} from "@/lib/platform/search";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<SearchResultType, typeof Search> = {
  tool: FileText,
  template: FilePlus,
  product: Layers,
  article: Newspaper,
  documentation: BookOpen,
  recent: Clock,
};

/**
 * Platform-wide search.
 *
 * Opens with the keyboard (Cmd/Ctrl+K) or the toolbar button. Requests are
 * debounced and superseded, so fast typing never renders a stale result set.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSequence = useRef(0);

  const closeRef = useRef<() => void>(() => {});
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Cmd/Ctrl+K opens search from anywhere on the platform.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") closeRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** Closing resets the dialog; doing it here avoids a state write in an effect. */
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
  }, []);

  // Focus the field once the dialog has mounted.
  const focusInput = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    node?.focus();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // Bump the sequence so any in-flight response is ignored, and clear on a
      // microtask so the effect itself does not write state synchronously.
      requestSequence.current += 1;
      const reset = window.setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(reset);
    }

    const sequence = ++requestSequence.current;
    const controller = new AbortController();

    // A short debounce keeps typing responsive without flooding the endpoint.
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as { results: SearchResult[] };
        // Ignore responses that arrived after a newer request was issued.
        if (sequence !== requestSequence.current) return;
        setResults(data.results);
        setActiveIndex(0);
      } catch {
        if (sequence === requestSequence.current) setResults([]);
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    }, 140);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Keep the key listener pointed at the current close handler.
  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) go(target.href);
    }
  }

  // Group while preserving the server's relevance order within each group.
  const grouped = searchTypeOrder
    .map((type) => ({ type, items: results.filter((result) => result.type === type) }))
    .filter((group) => group.items.length > 0);

  let renderIndex = -1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          className
        )}
        aria-label="Search LaunchStack"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden lg:inline">Search</span>
        <kbd className="hidden lg:inline rounded border border-border/60 px-1.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm p-4 sm:p-6 md:pt-[12vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Search LaunchStack"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="mx-auto w-full max-w-2xl rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border/60 px-4">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <input
                ref={focusInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search products, tools, articles and docs..."
                className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                aria-label="Search query"
                autoComplete="off"
              />
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              <p className="sr-only" role="status" aria-live="polite">
                {results.length} results
              </p>

              {query.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Type at least two characters to search
                </p>
              ) : !loading && !results.length ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No results for “{query.trim()}”
                </p>
              ) : (
                grouped.map((group) => (
                  <div key={group.type} className="mb-2 last:mb-0">
                    <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {searchTypeLabels[group.type]}
                    </p>
                    <ul>
                      {group.items.map((result) => {
                        renderIndex += 1;
                        const index = renderIndex;
                        const Icon = TYPE_ICON[result.type];
                        return (
                          <li key={result.id}>
                            <button
                              type="button"
                              onClick={() => go(result.href)}
                              onMouseEnter={() => setActiveIndex(index)}
                              className={cn(
                                "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                                index === activeIndex ? "bg-accent" : "hover:bg-accent/50"
                              )}
                            >
                              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">
                                    {result.title}
                                  </span>
                                  {result.context && (
                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                      {result.context}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {result.description}
                                </p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">
              <span>Navigate with arrow keys</span>
              <span>Enter to open · Esc to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

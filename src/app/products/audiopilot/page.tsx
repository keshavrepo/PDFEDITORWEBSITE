import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Mic, Sparkles } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProduct, platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";
import { sessions } from "@/lib/audiopilot";
import { buildPageMetadata } from "@/lib/seo";

const product = getProduct("audiopilot");
const url = `${getAppUrl()}/products/audiopilot`;
const description =
  product?.description ??
  "AudioPilot is LaunchStack's audio workspace. Batch 1 ships a reusable audio workspace with an Audio Player, an Audio Trimmer, an Audio Converter and a Recorder. Batch 2 adds the professional audio workflow: Audio Merger, Audio Splitter, Metadata Editor, Batch Processing and Audio Library. Everything runs in your browser and reuses the same LaunchStack authentication, dashboard, storage, search, file manager, settings and notifications every other product ships.";

export const metadata: Metadata = buildPageMetadata({
  path: "/products/audiopilot",
  title: "AudioPilot — A professional audio workspace",
  description,
  keywords: [
    "AudioPilot",
    "audio workspace",
    "audio editor",
    "audio player",
    "audio trimmer",
    "audio converter",
    "audio merger",
    "audio splitter",
    "metadata editor",
    "batch processing",
    "audio library",
    "recorder",
    "MP3",
    "WAV",
    "OGG",
    "FLAC",
    "AAC",
    "LaunchStack",
  ],
});

export const dynamic = "force-dynamic";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "AudioPilot",
      url,
      description,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any modern browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: "Keshav Labs" },
      isPartOf: { "@type": "WebSite", name: platform.name, url: getAppUrl() },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl() },
        { "@type": "ListItem", position: 2, name: "Products", item: `${getAppUrl()}/products` },
        { "@type": "ListItem", position: 3, name: "AudioPilot", item: url },
      ],
    },
  ],
};

/** The features the product page advertises. */
const FEATURE_HIGHLIGHTS = [
  "Audio Player — Play, Pause, Stop, Seek, Volume, Mute, Playback Speed (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x), Loop, Current Time, Duration, Waveform Preview",
  "Audio Trimmer — Trim Start, Trim End, Precision Controls (0.01s, 0.05s, 0.1s), Live Preview, Undo, Redo, Export",
  "Audio Converter — MP3, WAV, OGG, FLAC, AAC import and export with metadata preservation where the format supports it",
  "Recorder — Microphone Recording, Pause, Resume, Stop, Playback, Save Recording",
  "Audio Merger — merge unlimited audio files, reorder tracks, remove tracks, live preview, gap between tracks, fade between tracks, export merged audio",
  "Audio Splitter — split by time, split by markers, split into equal parts, split by silence, preview every segment, export selected segments",
  "Metadata Editor — title, artist, album, genre, year, track number, comments, cover art, save metadata",
  "Batch Processing — batch convert, batch rename, batch metadata update, batch export, progress tracking, cancel processing",
  "Audio Library — recent files, favorites, search, sort, filter, duplicate, rename, delete",
  "Reuses the LaunchStack workspace shell, IndexedDB storage, autosave loop, dashboard, search, file manager, settings and notifications — no second workspace was created",
];

/** What ships across Batch 1 + Batch 2 + Batch 3 + Batch 4. */
const LAUNCHED_CHECKLIST = [
  "Batch 4 — Project Manager: every workspace-rail capability (create, open, duplicate, rename, delete, favourite, search, recent) surfaced in the Productivity quick actions and the Command Palette",
  "Batch 4 — Session recovery: when the workspace shell mounts with no open tabs, a card at the top of the main area offers to restore the most recent sessions for the current tool",
  "Batch 4 — Drag & drop upload: every surface that accepts audio now mounts a shared drop zone that highlights on hover and forwards dropped files to the same handler the file input uses",
  "Batch 4 — Multi-file upload: the Library, Batch and Merger surfaces accept multiple files at once through a single file input",
  "Batch 4 — File naming and collision handling: every export helper funnels through a single safeFileName helper that strips illegal characters and appends ' (n)' on collision",
  "Batch 4 — Download history: the Library body now carries a per-session download history, rendered as a separate card on the Library surface",
  "Batch 4 — Shared hooks and utilities: useFileDrop, useKeyboardShortcuts, safeFileName, triggerDownload, shortUid, formatBytesShort, isValidExportResult live in src/lib/audiopilot/hooks/ and src/lib/audiopilot/utils.ts",
  "Batch 3 — Waveform Editor: high-resolution waveform, zoom in / out, horizontal scroll, timeline ruler, click-and-drag selection, playback cursor, region markers",
  "Batch 3 — Audio Effects: fade in, fade out, normalize, silence generator, reverse, speed, pitch, preview before applying, per-session undo / redo",
  "Batch 3 — Silence Detection: energy-threshold silence walk, adjustable threshold and minimum duration, jump between regions, split at silence, remove silence, per-region RMS",
  "Batch 3 — Export Center: per-job queue, target format / bitrate / sample rate / channels, selection-only export, progress indicator, cancel between jobs, per-job download",
  "Batch 3 — Workspace Productivity: Command Palette (Ctrl/Cmd + Shift + P) with fuzzy search, keyboard shortcut reference, recent sessions, quick actions, tunable workspace settings",
  "Batch 2 — Audio Merger: merge unlimited audio files, reorder and remove tracks, gap and crossfade between tracks, live preview, sample-accurate export through the platform's OfflineAudioContext",
  "Batch 2 — Audio Splitter: split by time, split by markers, split into equal parts, split by silence, preview every segment, export selected segments as a ZIP",
  "Batch 2 — Metadata Editor: standard tag fields (title, artist, album, genre, year, track number, comments), cover art, save metadata",
  "Batch 2 — Batch Processing: batch convert, batch rename, batch metadata update, batch export, per-item progress, cancel between items, result ZIP",
  "Batch 2 — Audio Library: every imported file in one place, search, sort, format filter, favourites-only filter, rename, duplicate, delete, tags",
  "Batch 1 — Audio Player: play, pause, stop, seek, volume, mute, playback speed, loop, current time, duration, waveform preview",
  "Batch 1 — Audio Trimmer: trim start, trim end, precision controls, live preview, undo, redo, export",
  "Batch 1 — Audio Converter: MP3, WAV, OGG, FLAC, AAC import and export with metadata preservation",
  "Batch 1 — Recorder: microphone recording with pause, resume, stop, playback, save recording",
  "AudioPilot workspace shell with left navigation, tool switcher, workspace header, recent sessions, favourites, autosave, keyboard shortcuts and shortcuts dialog",
  "Two new database tables: audio_sessions and audio_history, both keyed per user, mirroring the WebPilot / DevPilot recent-mirror pattern",
  "Two new API endpoints: /api/audiopilot/{sessions, sessions/[id], history}, all rate-limited and origin-checked",
  "The default /audiopilot landing opens the Workspace Dashboard; the rail and the new-session menu link to every other surface",
];

/** What's coming next. */
const ROADMAP = [
  "Multi-track Audio Editor with timeline, track lanes, fades, gain, panning, mute / solo, and per-track effects",
  "Audio Effects rack with EQ, compressor, reverb, delay, limiter, gate, de-esser, sidechain",
  "Noise Reduction and Audio Restoration tools (spectral denoise, de-clip, de-hum, de-reverb)",
  "Voice & Music AI tools: transcription, alignment, stem separation, mastering presets, AI mix assist",
  "Audio Search: search the metadata of every project file, jump to a timecode, export a cue sheet",
];

export default async function AudioPilotProductPage() {
  const user = await getSession();
  const productStatus = product?.status ?? "coming-soon";

  return (
    <>
      <Navbar user={user} />
      <main className="animate-page-in">
        <section className="border-b border-border/40 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs">
              <Sparkles className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              Batch 2 · Professional audio workflow
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {product?.name ?? "AudioPilot"}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              {product?.tagline ??
                "A professional audio workspace in your browser."}
            </p>
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button asChild className="gap-1.5">
                <Link href="/audiopilot">
                  Open the workspace
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              {productStatus === "active" && (
                <Button asChild variant="ghost" className="gap-1.5">
                  <Link href="/audiopilot/merger">
                    Open the Audio Merger
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-lg font-semibold">What ships across Batch 1 and Batch 2</h2>
            <Card className="p-6">
              <ul className="space-y-2 text-sm">
                {LAUNCHED_CHECKLIST.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="border-b border-border/40 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-lg font-semibold">Why AudioPilot</h2>
            <Card className="p-6">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {FEATURE_HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Mic
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-lg font-semibold">All tools</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {sessions
                .filter((entry) => entry.slug && entry.slug !== "dashboard")
                .map((entry) => (
                  <li key={entry.kind}>
                    <Card className="p-4">
                      <p className="text-sm font-medium">{entry.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.tagline}
                      </p>
                      {entry.slug && (
                        <Link
                          href={`/audiopilot/${entry.slug}`}
                          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Open
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      )}
                    </Card>
                  </li>
                ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-border/40 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-6 text-lg font-semibold">What&apos;s coming next</h2>
            <Card className="p-6">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {ROADMAP.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <ArrowRight
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="mb-4 text-lg font-semibold">Reused from the LaunchStack platform</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              AudioPilot reuses the same authentication, dashboard, file manager,
              search, notification centre, settings and analytics that ship
              with PDFPilot, ImagePilot, OfficePilot, DevPilot, SocialPilot,
              FinancePilot and WebPilot. No new shared infrastructure was
              created for this product.
            </p>
          </div>
        </section>
      </main>

      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}

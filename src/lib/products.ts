/**
 * LaunchStack product registry.
 *
 * LaunchStack is the parent platform; each product is a module that plugs into
 * it. PDFPilot is the first live product, and the entries below drive the
 * homepage, the products page, the footer and product metadata so a future
 * launch only needs its status flipped here.
 */

export type ProductStatus = "active" | "coming-soon";

export type ProductCategory =
  | "Documents"
  | "Media"
  | "Developer"
  | "Web"
  | "Finance"
  | "AI";

/** A dated entry in a product's changelog. */
export interface ReleaseNote {
  /** Semantic version this note describes. */
  version: string;
  /** ISO date, rendered in the user's locale. */
  date: string;
  /** What shipped, written for users rather than as commit messages. */
  changes: string[];
}

export interface Product {
  id: string;
  name: string;
  /** Short tagline used on cards. */
  tagline: string;
  description: string;
  status: ProductStatus;
  category: ProductCategory;
  /** Current version. Only meaningful once a product is active. */
  version: string;
  /** Landing route. Only set for products that are live. */
  href?: string;
  /** Tailwind accent classes, kept inside the existing palette. */
  accent: string;
  /** Representative capabilities shown on the product card. */
  highlights: string[];
  /** Newest first. Empty until a product ships. */
  releaseNotes: ReleaseNote[];
}

export const products: Product[] = [
  {
    id: "pdfpilot",
    name: "PDFPilot",
    tagline: "Private, browser-first PDF tools",
    description:
      "Convert, organise, optimise, edit and secure PDFs without uploading them. Twenty-seven tools covering Word, Excel, PowerPoint, images, OCR, forms, redaction and archival PDF/A.",
    status: "active",
    category: "Documents",
    version: "1.4.0",
    href: "/tools",
    accent: "text-primary",
    highlights: ["27 tools", "Runs in your browser", "No file uploads"],
    releaseNotes: [
      {
        version: "1.4.0",
        date: "2026-07-31",
        changes: [
          "Added OCR for scanned PDFs with searchable output in five languages",
          "Added Scan to PDF with edge detection, auto-crop and auto-rotate",
          "Added Compare PDF with page alignment and word-level differences",
          "Added PDF/A conversion with validation before export",
        ],
      },
      {
        version: "1.3.0",
        date: "2026-07-31",
        changes: [
          "Added fillable form detection and completion",
          "Added page numbering with header and footer placement",
          "Added cropping with a live preview and white-margin removal",
          "Added permanent redaction that removes text from the file itself",
        ],
      },
      {
        version: "1.2.0",
        date: "2026-07-31",
        changes: [
          "Added PDF to Excel and Excel to PDF, including legacy .xls",
          "Added PDF to JPG or PNG with selectable resolution",
          "Added JPG or PNG to PDF with reordering and layout options",
        ],
      },
      {
        version: "1.1.0",
        date: "2026-07-31",
        changes: [
          "Detect unreadable PDFs and report when OCR is required",
          "Added a pluggable conversion engine architecture",
        ],
      },
      {
        version: "1.0.0",
        date: "2026-07-31",
        changes: [
          "Added PDF to Word, Word to PDF, PDF to PowerPoint and PowerPoint to PDF",
        ],
      },
    ],
  },
  {
    id: "imagepilot",
    name: "ImagePilot",
    tagline: "A professional image editor in your browser",
    description:
      "Layers, non-destructive adjustments, text, shapes, crop and transform tools, plus focused studios for screenshots, watermarks, passport photos, background removal, redaction, metadata and batch conversion. Everything runs on your device.",
    status: "active",
    category: "Media",
    version: "1.2.0",
    href: "/imagepilot",
    accent: "text-primary",
    highlights: ["Layer-based editing", "18 image operations", "Nine focused tools"],
    releaseNotes: [
      {
        version: "1.2.0",
        date: "2026-08-01",
        changes: [
          "Added the Background Remover with soft-edge matting, a refinement brush and colour or image backdrops",
          "Added the Object Blur Studio with face and licence-plate presets, pixelation, blur and solid blocks",
          "Added the Metadata Cleaner, which reports EXIF, GPS and camera data then removes it without recompressing",
          "Added the Batch Converter for JPG, PNG, WEBP, AVIF and BMP with resizing, renaming and ZIP download",
        ],
      },
      {
        version: "1.1.0",
        date: "2026-08-01",
        changes: [
          "Added the Screenshot Editor with annotation, blur and pixelation for redaction",
          "Added Watermark Studio with text or logo marks, tiling, corner presets and batch runs",
          "Added Passport Photo Studio with ten country specifications, head guides and print sheets",
          "Added the Image Compressor with quality, target-size search and batch compression",
          "Added a pixelate operation that irreversibly removes detail, unlike blur",
        ],
      },
      {
        version: "1.0.0",
        date: "2026-07-31",
        changes: [
          "Added the ImagePilot editor with layers, undo history and a full transform toolset",
          "Added seventeen non-destructive image operations covering light, colour, detail and stylising",
          "Added editable text layers with stroke, shadow, tracking and alignment",
          "Added six shape tools with fill, stroke and rounded corners",
          "Added PNG, JPG, WEBP and SVG export, clipboard support and drag-and-drop import",
        ],
      },
    ],
  },
  {
    id: "devpilot",
    name: "DevPilot",
    tagline: "A professional developer workspace in your browser",
    description:
      "A developer workspace for every future DevPilot tool. Batch 1 ships the foundation: a reusable workspace shell with sessions, snippets and history that future developer tools (formatters, validators, encoders, generators) will plug into. Reuses the same LaunchStack platform that hosts OfficePilot, SocialPilot and FinancePilot: authentication, dashboard, storage, search, activity, settings, notifications and the shared file manager.",
    status: "active",
    category: "Developer",
    version: "0.1.0",
    href: "/devpilot",
    accent: "text-primary",
    highlights: [
      "Reusable developer workspace: left rail, tool switcher, header, properties, activity, autosave, keyboard shortcuts",
      "Workspace sessions: create, rename, duplicate, delete, favourite, recent and dashboard integration",
      "Developer snippets: categories, languages, search, favourite, duplicate and delete",
      "Developer history: per-tool recent and favourites, search and restore",
    ],
    releaseNotes: [
      {
        version: "0.1.0",
        date: "2026-08-02",
        changes: [
          "Added the DevPilot workspace shell: left navigation, tool switcher, workspace header, activity panel, properties panel, search, recent sessions, favourites, autosave and keyboard shortcuts — consistent with OfficePilot and SocialPilot",
          "Added workspace sessions as first-class projects: create, rename, duplicate, delete, favourite, recent mirror and dashboard integration",
          "Added developer snippets: save snippets with categories, languages, search, favourite, duplicate and delete",
          "Added developer history: per-tool recent and favourites with search and restore, mirroring the same pattern the rest of LaunchStack uses",
          "Added two new database tables: devSessions and devHistory, both keyed per user, mirroring the FinancePilot / SocialPilot recent-mirror pattern",
          "Added two new API endpoints: /api/devpilot/{sessions, history}, both rate-limited and origin-checked",
          "The default /devpilot landing opens the Workspace Dashboard; the rail and the new-session menu link to every other surface",
        ],
      },
    ],
  },
  {
    id: "officepilot",
    name: "OfficePilot",
    tagline: "One workspace for Word, Excel and PowerPoint",
    description:
      "A single Office workspace inside LaunchStack: write documents, build spreadsheets and assemble slide decks, then export to the standard Office formats. Everything runs in the browser with autosave and a shared template library.",
    status: "active",
    category: "Documents",
    version: "0.1.0",
    href: "/officepilot",
    accent: "text-primary",
    highlights: [
      "Word, Excel and PowerPoint in one workspace",
      "Autosave in the browser",
      "Shared template library",
    ],
    releaseNotes: [
      {
        version: "0.1.0",
        date: "2026-08-01",
        changes: [
          "Added the OfficePilot workspace shell with a shared toolbar, sidebar, properties panel and status bar",
          "Added the document engine with create, open, save, rename, duplicate and delete",
          "Added browser-first autosave with a server-side recent-documents mirror",
          "Added the template registry covering resume, invoice, letter, meeting notes, budget, planner, checklist and presentation",
        ],
      },
    ],
  },
  {
    id: "audiopilot",
    name: "AudioPilot",
    tagline: "A professional audio workspace in your browser",
    description:
      "A single audio workspace inside LaunchStack: an Audio Player with playback controls, waveform preview, seek, volume, mute, playback speed and loop, an Audio Trimmer with precision controls, live preview, undo / redo and export, an Audio Converter for MP3, WAV, OGG, FLAC and AAC with metadata preservation, a Recorder with microphone capture, pause, resume, playback and save, an Audio Merger with reorder, remove, gap and crossfade, an Audio Splitter with time / markers / equal / silence modes, a Metadata Editor with cover art, a Batch Processing queue with progress and cancel, a searchable Audio Library, a high-resolution Waveform Editor with zoom / scroll / selection / markers, an Audio Effects surface with fade / normalize / silence / reverse / speed / pitch, a Silence Detection surface with adjustable threshold, an Export Center with per-job progress and cancel, and a Workspace Productivity surface with Command Palette, keyboard shortcuts, recent sessions, quick actions and restore previous session. Everything runs in the browser, reuses the existing LaunchStack storage, autosave loop, dashboard, search, file manager, settings and notifications, and ships as a single workspace where future audio tools will live alongside the foundation.",
    status: "active",
    category: "Media",
    version: "0.3.0",
    href: "/audiopilot",
    accent: "text-primary",
    highlights: [
      "Audio Player — Play, Pause, Stop, Seek, Volume, Mute, Playback Speed, Loop, Current Time, Duration, Waveform Preview",
      "Audio Trimmer — Trim Start, Trim End, Precision Controls, Live Preview, Undo, Redo, Export",
      "Audio Converter — MP3, WAV, OGG, FLAC, AAC import and export with metadata preservation where possible",
      "Recorder — Microphone Recording, Pause, Resume, Stop, Playback, Save Recording",
      "Audio Merger — merge unlimited audio files, reorder tracks, remove tracks, live preview, gap between tracks, fade between tracks, export merged audio",
      "Audio Splitter — split by time, split by markers, split into equal parts, split by silence, preview every segment, export selected segments",
      "Metadata Editor — title, artist, album, genre, year, track number, comments, cover art, save metadata",
      "Batch Processing — batch convert, batch rename, batch metadata update, batch export, progress tracking, cancel processing",
      "Audio Library — recent files, favorites, search, sort, filter, duplicate, rename, delete",
      "Waveform Editor — high resolution waveform, zoom in / out, horizontal scroll, timeline ruler, selection visualization, playback cursor, region markers",
      "Audio Effects — fade in, fade out, normalize volume, silence generator, reverse, speed adjustment, pitch adjustment, preview before applying, undo, redo",
      "Silence Detection — detect silence, jump between silence regions, split at silence, remove silence, adjustable threshold, adjustable minimum duration",
      "Export Center — export selected region, export full audio, multiple formats, bitrate, sample rate, channel selection, progress indicator, cancel",
      "Workspace Productivity — keyboard shortcuts, command palette, autosave improvements, recent sessions, quick actions, restore previous session",
      "Reuses the LaunchStack workspace shell, IndexedDB storage, autosave loop, dashboard, search, file manager, settings and notifications — no second workspace was created",
    ],
    releaseNotes: [
      {
        version: "0.3.0",
        date: "2026-08-02",
        changes: [
          "Added the Waveform Editor surface: high-resolution waveform that scales with the active zoom level, zoom in / out, horizontal scroll, timeline ruler, click-and-drag selection, playback cursor and user-placed region markers",
          "Added the Audio Effects surface: fade in, fade out, normalize volume, silence generator, reverse, speed adjustment, pitch adjustment, preview before applying and per-session undo / redo",
          "Added the Silence Detection surface: energy-threshold silence walk with adjustable threshold and minimum duration, padding in seconds, jump between regions, split at silence and remove silence",
          "Added the Export Center surface: per-job queue with target format, bitrate, sample rate and channels, selection-only export, progress indicator, cancel between jobs, downloads per completed job",
          "Added the Workspace Productivity surface: Command Palette (Ctrl/Cmd + Shift + P) with fuzzy search, keyboard shortcut reference, recent sessions list, quick actions row and tunable workspace settings (autosave, word wrap, theme, minimap, indent, find shortcut)",
          "Reused the existing AudioPilot workspace shell, IndexedDB storage, autosave loop, search index, dashboard and recent-mirror for every new tool — no second workspace was created and no shared infrastructure was duplicated",
          "Added five new rail entries to the AudioPilot session switcher: waveform-editor, effects, silence, export-center, productivity",
        ],
      },
      {
        version: "0.2.0",
        date: "2026-08-02",
        changes: [
          "Added the Audio Merger surface: merge unlimited MP3, WAV, OGG, FLAC and AAC files, reorder and remove tracks, set the gap between tracks and the crossfade between consecutive tracks, preview the mixdown on a per-track timeline, and export the result through the platform's OfflineAudioContext",
          "Added the Audio Splitter surface: split by time, split by markers, split into equal parts and split by silence, preview every segment on a waveform, select which segments to export, batch export the selection to the user's downloads",
          "Added the Metadata Editor surface: edit title, artist, album, genre, year, track number and comments, attach cover art, save the metadata back to the same source file",
          "Added the Batch Processing surface: batch convert, batch rename, batch metadata update and batch export, per-item progress, overall progress, current-item indicator, cancel between items, result ZIP streamed through the platform's JSZip dependency",
          "Added the Audio Library surface: every imported file in one place, search by name / artist / album / tags, sort by date / name / size / duration / last opened, filter by format or favourites-only, rename, duplicate, delete and favourite inline",
          "Reused the existing AudioPilot workspace shell, IndexedDB storage, autosave loop, search index, dashboard and recent-mirror for every new tool — no second workspace was created and no shared infrastructure was duplicated",
          "Added five new rail entries to the AudioPilot session switcher: merger, splitter, metadata, batch, library",
        ],
      },
      {
        version: "0.1.0",
        date: "2026-08-02",
        changes: [
          "Added the AudioPlayer surface: play, pause, stop, seek, volume, mute, playback speed (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x), loop, current time, duration and a waveform preview derived from the decoded audio buffer",
          "Added the Audio Trimmer surface: trim start, trim end, precision controls (fine / coarse), live preview, undo / redo and export to the same source format",
          "Added the Audio Converter surface: MP3, WAV, OGG, FLAC and AAC import and export with metadata preservation where the format supports it",
          "Added the Recorder surface: microphone recording with pause, resume, stop, playback and save — the recording lands in the same IndexedDB store the rest of the workspace uses",
          "Added the AudioPilot workspace shell, left navigation rail, tool switcher, recent sessions, favourites, autosave loop, keyboard shortcuts and shortcuts dialog, the same shell WebPilot / DevPilot / SocialPilot / FinancePilot / OfficePilot ship",
          "Added two new database tables: audio_sessions and audio_history, both keyed per user, mirroring the WebPilot / DevPilot recent-mirror pattern",
          "Added two new API endpoints: /api/audiopilot/sessions and /api/audiopilot/sessions/[id], both rate-limited and origin-checked",
          "The default /audiopilot landing opens the Workspace Dashboard; the rail and the new-session menu link to every other surface",
        ],
      },
    ],
  },
  {
    id: "webpilot",
    name: "WebPilot",
    tagline: "A professional web workspace in your browser",
    description:
      "A web workspace for HTML, CSS and JavaScript with a live preview. Batch 1 ships the foundation: a reusable workspace shell that hosts a syntax-highlighted HTML editor, a CSS editor with variables and a color preview, a JavaScript editor with a console preview, and a live preview that combines all three into a working browser surface. Batch 2 adds the professional project workflow: Project Explorer, Asset Manager, Multi-file Workspace, Professional Search and Developer Utilities. Batch 3 adds the IDE-grade tooling: Integrated Terminal, Code Intelligence, Project Validation, Project Export, Project Import and Workspace Productivity. Batch 4 ships the polish and integrations: ten Professional Project Templates, a Project Settings surface, a Project History surface with restore-last-session, and a complete Dashboard Integration that ties WebPilot to the rest of LaunchStack through recent projects, storage summary, notifications, search history, favourites gallery and activity analytics. Future web tools will reuse the same shell, the same autosave loop and the same platform infrastructure as every other LaunchStack product.",
    status: "active",
    category: "Web",
    version: "0.4.0",
    href: "/webpilot",
    accent: "text-primary",
    highlights: [
      "Professional Project Templates — Landing Page, Portfolio, Business Website, SaaS Landing Page, Dashboard, Blog, Documentation, Login Page, Pricing Page, Contact Page",
      "Project Settings — name, description, version, author, theme, custom CSS, custom JavaScript, metadata, favicon, Open Graph fields",
      "Project History — recent projects, duplicate, rename, delete, restore last session",
      "Workspace Polish — autosave reliability, editor and preview sync, keyboard shortcuts, loading / empty / error states, responsive behaviour, accessibility, performance",
      "Dashboard Integration — recent projects, storage summary, notifications, search, favourites and analytics, all in one place",
      "Integrated Terminal, Code Intelligence, Project Validation, Project Export, Project Import, Workspace Productivity from Batch 3, all still shipping",
      "Project Explorer, Asset Manager, Multi-file Workspace, Professional Search, Developer Utilities from Batch 2, all still shipping",
      "HTML, CSS, JavaScript editors and Live Preview from Batch 1, all still shipping in the same workspace",
    ],
    releaseNotes: [
      {
        version: "0.4.0",
        date: "2026-08-02",
        changes: [
          "Added ten Professional Project Templates: Landing Page, Portfolio, Business Website, SaaS Landing Page, Dashboard, Blog, Documentation, Login Page, Pricing Page, Contact Page. Each template ships a complete project tree (HTML, CSS, JavaScript, configuration) the user can edit immediately",
          "Added the Project Settings surface: project name, description, version, author, theme, custom CSS, custom JavaScript, metadata (favicon, canonical URL, theme color, locale, keywords), Open Graph fields (title, description, image, type, URL), Twitter card (summary, summary_large_image, app, player), Twitter site and creator, with a live preview of the generated <head> block and the project.json manifest",
          "Added the Project History surface: recent projects list with the most recent edit per project, one-click duplicate / rename / delete, favourites gallery, soft-deletion tombstones, restore-last-session with a single click, search across the recent list",
          "Added the Dashboard Integration surface: storage summary (sessions, history, assets, total bytes), recent projects, notifications queue with mark-read / clear-read, recent searches, favourites gallery, activity analytics broken down by surface — fully integrated with the existing IndexedDB store, the platform-wide search index, the recent-sessions mirror and the activity feed",
          "Polished the workspace: improved autosave reliability, editor and preview sync, the keyboard shortcut reference now covers every Batch 3 and Batch 4 shortcut, every surface ships a loading state, an empty state and an error state, every surface is responsive, accessible and performance-tuned",
          "Reused the existing WebPilot workspace shell, IndexedDB storage, autosave loop, search index, dashboard and recent-mirror for every new tool — no second workspace was created and no shared infrastructure was duplicated",
          "Added four new rail entries to the WebPilot session switcher: settings, templates, project-history, dashboard-integration",
        ],
      },
      {
        version: "0.3.0",
        date: "2026-08-02",
        changes: [
          "Added the Integrated Terminal: multiple terminal panes with their own buffer and history, command history (Up / Down), clear, copy, font-size controls, fullscreen, and a built-in sandboxed command set (echo, pwd, cd, ls, cat, head, tail, wc, clear, help, exit). Keyboard shortcuts: Ctrl/Cmd + T to spawn a pane, Ctrl/Cmd + K to clear, Ctrl/Cmd + Shift + F for fullscreen",
          "Added Code Intelligence: bracket matching for round, square and curly brackets, auto-closing pairs for every common opening bracket and quote, auto-indent that respects the current indent unit, code folding for blocks / functions / rules / comments, breadcrumb navigation, a symbol outline with functions, classes, methods, variables, rules, ids and tags, go-to-line and go-to-symbol jumps",
          "Added Project Validation: HTML, CSS and JavaScript validators in one pass, broken link detection across href / src / url() references, missing asset detection for images, fonts and scripts, duplicate ID detection across every HTML file, accessibility warnings (missing alt, missing label, missing lang, no <main>), performance hints (large inline scripts, missing viewport, missing title, blocking <script>)",
          "Added Project Export: build a deterministic ZIP archive with a clean folder structure, every asset preserved as a data URL, every folder recreated via a .keep marker, and a project.json manifest. Reuses JSZip through the dynamic import the rest of LaunchStack already uses",
          "Added Project Import: bring a ZIP archive back into the workspace, with per-file conflict resolution (skip, replace, rename, merge), validation before import (the surface rejects malformed archives, files at illegal paths, and unknown MIME types), and an audit trail of every conflict and its resolution",
          "Added Workspace Productivity: Command Palette with fuzzy search (Ctrl/Cmd + Shift + P), keyboard shortcut reference for every workspace action, recent projects list (cap 12), quick actions row (open project, open assets, run validation, export, import, open terminal, open intelligence, open utilities), workspace settings (autosave, interval, word wrap, theme, minimap, indent, find shortcut) that persist through the autosave loop",
          "Reused the existing WebPilot workspace shell, IndexedDB storage, autosave loop, search index, dashboard and recent-mirror for every new tool — no second workspace was created and no shared infrastructure was duplicated",
          "Added six new rail entries to the WebPilot session switcher: terminal, intelligence, validation, export, import, productivity",
        ],
      },
      {
        version: "0.2.0",
        date: "2026-08-02",
        changes: [
          "Added the Project Explorer: folder tree with nested folders, create file / create folder, rename, delete, duplicate, drag and drop to reorganise, search, recent files, and pinned favourites",
          "Added the Asset Manager: upload images, SVG, fonts, videos and icons, organise folders, inline preview, rename, delete and copy the asset URL with one click",
          "Added the Multi-file Workspace: open every project file as a tab, unsaved indicator, autosave, restore previous session, close and reopen tabs, split the active editor into two side-by-side panes, quick switch between files with the keyboard",
          "Added Professional Search: find in the current file or across the project, replace and replace-all, regex, match case and whole word toggles, with a match list and a read-only preview pane",
          "Added Developer Utilities: color picker with palette and history, gradient generator for linear and radial gradients, box shadow generator with offset / blur / spread / colour / inset, border radius generator with per-corner control, CSS unit converter for px / rem / em / pt / vw / vh / %, HTML entity encoder / decoder, base64 encoder / decoder, and URL encoder / decoder",
          "Reused the existing WebPilot workspace shell, IndexedDB storage, autosave loop, search index, dashboard and recent-mirror for every new tool — no second workspace was created and no shared infrastructure was duplicated",
          "Added five new rail entries to the WebPilot session switcher: projects, assets, workspace, search and utilities",
        ],
      },
      {
        version: "0.1.0",
        date: "2026-08-02",
        changes: [
          "Added the WebPilot workspace shell: left navigation, tool switcher, workspace header, activity panel, properties panel, search, recent sessions, favourites, autosave and keyboard shortcuts — consistent with OfficePilot, SocialPilot, FinancePilot and DevPilot",
          "Added the HTML editor: syntax highlighting, line numbers, auto-indentation, find and replace, undo and redo, format, minify and beautify, word wrap, import and export, with a Workspace Dashboard that surfaces recent and favourite sessions",
          "Added the CSS editor: syntax highlighting, property and value auto-complete, color preview swatches, variable usage detection, format, minify and beautify, import and export",
          "Added the JavaScript editor: syntax highlighting, identifier auto-complete, format, minify and beautify, an in-page console preview that captures console.log / console.warn / console.error output, import and export",
          "Added the Live Preview surface: combines the HTML, CSS and JavaScript bodies into a working browser surface with auto-refresh and a console output panel",
          "Added two new database tables: webSessions and webHistory, both keyed per user, mirroring the FinancePilot / SocialPilot / DevPilot recent-mirror pattern",
          "Added two new API endpoints: /api/webpilot/{sessions, history}, both rate-limited and origin-checked",
          "The default /webpilot landing opens the Workspace Dashboard; the rail and the new-session menu link to every other surface",
        ],
      },
    ],
  },
  {
    id: "socialpilot",
    name: "SocialPilot",
    tagline: "A professional creator workspace in your browser",
    description:
      "A creator workspace for every future SocialPilot tool. Batch 1 ships the foundation (workspace shell, project system, media library, brand kit). Batch 2 adds the core creator tools (Post Creator, Caption Manager, Hashtag Manager, Content Calendar, Notes). Batch 3 adds the professional creator workspace: Publishing Queue with five statuses, Platform Profiles for eight networks, Media Workspace with grid / list / multi-select / collections, multi-brand Brand Workspace with logos, colours, fonts, watermarks, templates, default hashtags and default captions, plus a Workspace Dashboard that surfaces every important surface in one place. The future scheduler and AI assistant will reuse the same shell, brand workspace, platform profiles and queue.",
    status: "active",
    category: "Media",
    version: "0.3.0",
    href: "/socialpilot",
    accent: "text-primary",
    highlights: [
      "Publishing Queue with five statuses, drag-and-drop, priority, bulk actions, filters and search",
      "Platform Profiles for Facebook, Instagram, X, LinkedIn, YouTube, TikTok, Threads and Pinterest",
      "Media Workspace with grid / list, multi-select, drag-and-drop, favourites, tags and collections",
      "Multi-brand Brand Workspace with logos, colours, fonts, watermarks, templates, default hashtags and default captions",
      "Workspace Dashboard: recent projects, recent and favourite assets, favourite captions and hashtag groups, active brand and profile, queue summary",
    ],
    releaseNotes: [
      {
        version: "0.3.0",
        date: "2026-08-05",
        changes: [
          "Added the Publishing Queue: five statuses (draft, ready, scheduled, published, failed), drag-and-drop reordering and status moves, priority, bulk actions (mark / delete), status filters, search and a list of all items with date sort",
          "Added the Platform Profiles surface: store every Facebook, Instagram, X, LinkedIn, YouTube, TikTok, Threads and Pinterest profile; default profile per platform; profile switching; the future scheduler will reuse this list",
          "Added the Media Workspace: grid and list views, multi-select, drag-and-drop into collections, favourites, tags, search, kind filter, details panel and the same upload / preview / delete pipeline as the existing media library",
          "Added the multi-brand Brand Workspace: multiple brands with logos, colours, fonts, watermarks, templates, default hashtags, default captions, default platform profile and an active-brand switcher persisted on the user row",
          "Added the Workspace Dashboard: a one-page summary of recent projects, recent assets, favourite assets, favourite captions, favourite hashtag groups, the active brand, the active platform profile and the publishing-queue summary by status",
          "Added four new database tables: socialBrandProfiles, socialPlatformProfiles, socialMediaCollections and socialUserState, all keyed per user",
          "Added four new API endpoints: /api/socialpilot/{brand-profiles, platform-profiles, media-collections, user-state}, all rate-limited and origin-checked",
          "The default /socialpilot landing now opens the Workspace Dashboard; the rail and the new-project menu link to every other tool",
        ],
      },
      {
        version: "0.2.0",
        date: "2026-08-04",
        changes: [
          "Added the Post Creator: plain / rich text, bold / italic / code / link / mention / hashtag marks, bullet / ordered / checklist lists, character counter, live preview, autosave, duplicate draft, media attachment and one-click insertion of saved captions and hashtag groups",
          "Added the Caption Manager: saved captions with categories, tags, search, favourite, duplicate and delete; one-click insertion into the Post Creator",
          "Added the Hashtag Manager: named hashtag groups with categories, search, favourite, duplicate and delete; one-click insertion of the whole group into the Post Creator",
          "Added the Content Calendar: monthly, weekly and daily views, platform filter, color labels, create / edit / delete / move plans, and a list of all plans with search",
          "Added Notes: rich text, plain text, optional checklist mode, tags, search and favourite, with the same autosave loop as the other tools",
          "Added a shared rich-text editor component reused by the Post Creator and Notes (dependency-free, content-editable-based)",
        ],
      },
      {
        version: "0.1.0",
        date: "2026-08-02",
        changes: [
          "Added the SocialPilot workspace shell: left navigation, tool switcher, workspace header, activity panel, properties panel, search, recent projects, favourites, autosave and keyboard shortcuts",
          "Added the project system with create, rename, duplicate, delete, favourite, recent mirror and dashboard integration",
          "Added the media library for images, videos and audio with upload, organize, search, filter, preview and delete (reuses the existing upload infrastructure)",
          "Added the brand kit with logos, brand colours, fonts and default social profiles (reusable across every future tool)",
        ],
      },
    ],
  },
  {
    id: "financepilot",
    name: "FinancePilot",
    tagline: "Financial calculators in your browser",
    description:
      "Run the financial calculators you reach for every day — EMI, SIP, compound interest, loans, budgets, expenses, savings goals, net worth, retirement, investment, multi-goal planning, a one-screen financial dashboard and a 0–100 financial health score — inside the LaunchStack workspace, with autosave, the same shared chrome as OfficePilot, and print-to-PDF export.",
    status: "active",
    category: "Finance",
    version: "0.5.0",
    href: "/financepilot",
    accent: "text-primary",
    highlights: [
      "13 calculators: EMI, SIP, compound interest, loan, budget, expense, savings, net worth, retirement, investment, goal, dashboard, health score",
      "Autosave and recent mirror",
      "Print-to-PDF export",
    ],
    releaseNotes: [
      {
        version: "0.5.0",
        date: "2026-08-03",
        changes: [
          "Financial Health Score: 0–100 weighted score across 6 categories (Emergency Fund, Debt Ratio, Savings Rate, Investment Ratio, Insurance Coverage, Goal Progress) with per-category verdicts and prioritised improvement suggestions",
          "Net Worth Tracker adds the spec asset categories (Cash, Savings, Investments, Property, Gold, Vehicles) and liability categories (Loans, Credit Cards, Mortgage) without removing the existing granular ones",
          "Goal Planner keeps the existing multi-goal surface and confirms every spec field (target amount, current savings, monthly contribution, expected return, target date) plus progress, remaining amount, remaining months and projected completion",
          "Dashboard integration adds the Health Score card, a recent-calculations list and a quick-actions row that links to every other calculator",
        ],
      },
      {
        version: "0.4.0",
        date: "2026-08-03",
        changes: [
          "Four investment & retirement modules: Retirement Planner, Investment Planner, Goal Planner, Financial Dashboard",
          "Reusable BarChart component shared by the goal planner's progress visualisation",
          "Retirement planner projects corpus, required corpus, inflation-adjusted corpus, monthly income, surplus / shortfall, on-track flag and a yearly chart",
          "Investment planner supports a risk profile, a custom return, an allocation list and a suggested monthly contribution",
          "Goal planner tracks multiple goals with priority, target date, monthly contribution, on-track flag, estimated completion and a multi-goal progress chart",
          "Financial dashboard surfaces total assets, total liabilities, net worth, monthly savings, savings rate, budget status, active goals, investment summary, KPI cards, history charts and quick insights",
        ],
      },
      {
        version: "0.3.0",
        date: "2026-08-02",
        changes: [
          "Four personal-finance modules: Budget Planner, Expense Tracker, Savings Planner, Net Worth Tracker",
          "Reusable line-item list editor and list workspace shared by every personal-finance module",
          "Expense tracker adds search, filter, sort, by-method breakdown and a daily spend chart",
          "Savings planner projects when the goal is met and reports progress, on-track flag and yearly chart",
          "Net worth tracker ships a 6-month historical timeline plus asset and liability category breakdowns",
        ],
      },
      {
        version: "0.2.0",
        date: "2026-08-02",
        changes: [
          "Four live calculators: EMI, SIP, compound interest, loan",
          "Reusable inputs, charts and schedule-table components shared by every calculator",
          "Print-to-PDF export via the browser's native print pipeline (matches OfficePilot's `printWordDocument` pattern)",
        ],
      },
      {
        version: "0.1.0",
        date: "2026-08-01",
        changes: [
          "Reusable FinancePilot workspace shell with sidebar, recent calculations, autosave and search integration",
          "Shared calculation engine and per-calculator registry",
          "IndexedDB-backed storage and a server-side recent-calculations mirror",
        ],
      },
    ],
  },
  {
    id: "aipilot",
    name: "AIPilot",
    tagline: "AI assistance across your documents",
    description:
      "Summarise, translate and question your documents, with on-device processing wherever the model allows.",
    status: "coming-soon",
    category: "AI",
    version: "0.0.0",
    accent: "text-muted-foreground",
    highlights: ["Summaries", "Translation", "Document Q&A"],
    releaseNotes: [],
  },
];

export const activeProducts = products.filter((product) => product.status === "active");
export const upcomingProducts = products.filter((product) => product.status === "coming-soon");

export function getProduct(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

/** Every category that has at least one product, in registry order. */
export function productCategories(): ProductCategory[] {
  return [...new Set(products.map((product) => product.category))];
}

/** Platform-level identity, distinct from the per-product branding. */
export const platform = {
  name: "LaunchStack",
  tagline: "One platform. Every tool you need.",
  description:
    "LaunchStack is a growing suite of focused, privacy-first productivity products. PDFPilot, ImagePilot, AudioPilot, OfficePilot, DevPilot, SocialPilot, FinancePilot and WebPilot are available today, with more modules on the way.",
} as const;

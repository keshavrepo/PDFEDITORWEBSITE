# LaunchStack

LaunchStack is a Next.js platform hosting a suite of focused, privacy-first
productivity products. Each product is a module that shares the platform's
account system, billing, blog and design system.

**PDFPilot** is the first live product: a complete set of browser-based PDF
tools for securely processing documents without uploading them.

**ImagePilot** is the second: a professional image editor with layers, undo
history, non-destructive adjustments, text and shapes, exporting to PNG, JPG,
WEBP and SVG. Eight focused studios — Screenshot Editor, Watermark Studio,
Passport Photo Studio, Image Compressor, Background Remover, Object Blur
Studio, Metadata Cleaner and Batch Converter — are configurations of that same
editor rather than separate applications.

DevPilot, OfficePilot, WebPilot, FinancePilot and AIPilot are registered on the
platform and marked as coming soon.

Products are declared in `src/lib/products.ts`, which drives the homepage,
the products page and the footer. Launching a new module is a matter of adding
its entry and flipping the status, with no changes needed in the surrounding
navigation or layout.

## Platform services

Shared services live in `src/lib/platform` and are used by every product, so a
new module inherits them rather than reimplementing them:

- **Global search** (`search.ts`) indexes products, tools and documentation in
  memory and merges published blog articles from the database. Open it
  anywhere with `Cmd`/`Ctrl`+`K`.
- **File manager** (`files.ts`) is one shared history. Files carry a
  `productId`, so listing, searching, renaming, favouriting, downloading and
  deleting work the same for every product. Deletes are soft, which keeps the
  related processing history intact.
- **Activity and notifications** (`activity.ts`) merge conversions, uploads and
  audit-log events into one timeline, and back the notification centre.
  Products report work by posting to `/api/activity`.
- **Usage statistics** (`usage.ts`) derive dashboard figures from the user's
  own rows; when nothing has run the numbers are genuinely zero.
- **Preferences** (`preferences.ts`) store theme and per-category notification
  settings on the account.

## Platform routes

| Route | Purpose |
| --- | --- |
| `/` | LaunchStack homepage and product suite |
| `/products` | Every product, with availability |
| `/products/pdfpilot` | PDFPilot product overview |
| `/products/imagepilot` | ImagePilot product overview |
| `/tools` | PDFPilot tool directory (unchanged) |
| `/tools/*` | Individual PDF tools (unchanged) |
| `/imagepilot` | ImagePilot image editor |
| `/imagepilot/screenshot-editor` | Annotate and redact screenshots |
| `/imagepilot/watermark-studio` | Text and logo watermarks, single or batch |
| `/imagepilot/passport-photo` | Compliant ID photos and print sheets |
| `/imagepilot/compressor` | Compress JPG, PNG and WEBP |
| `/imagepilot/background-remover` | Cut out a subject, replace the backdrop |
| `/imagepilot/object-blur` | Hide faces, plates and private details |
| `/imagepilot/metadata-cleaner` | Inspect and strip EXIF, GPS and camera data |
| `/imagepilot/converter` | Batch convert, resize, rename and ZIP |
| `/files` | Unified file manager, shared by every product |
| `/dashboard` | Storage, files, activity, favourites and usage |
| `/docs` | Documentation, with guides authored in the blog CMS |

Existing PDFPilot URLs are preserved exactly; `/pdfpilot` and `/product/pdfpilot`
are added as convenience aliases that redirect into the platform routes.

## Architecture

- **Web:** Next.js App Router, React, TypeScript, Tailwind CSS
- **Authentication:** NextAuth JWT sessions with credentials and optional Google OAuth
- **Persistence:** PostgreSQL, Drizzle ORM, versioned SQL migrations
- **PDF processing:** `pdf-lib` and `pdfjs-dist` in client components
- **Image editing:** isomorphic editor core under `src/lib/imagepilot`. The document model, pixel pipeline, renderer and exporter are written against the standard 2D canvas surface with no DOM dependency, so the same modules run in the browser and headlessly in tests. Browser-only concerns (decoding, clipboard, downloads) are isolated in `raster.ts`
- **Document conversion:** isomorphic converters under `src/lib/conversion` using `pdfjs-dist`, `pdf-lib`, `docx` and `pptxgenjs`. Spreadsheet support (`.xlsx` and legacy `.xls`) is read and written directly from `src/lib/conversion/spreadsheet`, reusing the existing OOXML helpers rather than adding a dependency
- **Billing:** Stripe Checkout, Customer Portal, and signed webhooks
- **Email:** Resend's HTTPS API (optional, for support and password reset)

Source is organized by App Router route under `src/app`, shared UI under `src/components`, server integrations under `src/lib`, and the data model under `src/db`.

## Local development

1. Install Node.js 20.9 or newer and PostgreSQL.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment template and fill in required values:

   ```bash
   cp .env.example .env.local
   ```

4. Apply database migrations and start the app:

   ```bash
   npm run db:migrate
   npm run dev
   ```

Open <http://localhost:3000>. Google sign-in, email delivery, and billing are enabled only when their complete environment-variable groups are configured.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
# or all three
npm run check
```

Both products have end-to-end suites that run the production code paths, not
mocks:

```bash
npm test                  # both suites
npm run test:conversions  # 147 document conversion tests
npm run test:imagepilot   # 182 image editor tests
```

The conversion suite runs the real converters against generated Word,
PowerPoint and PDF fixtures. The ImagePilot suite renders real pixels through
`@napi-rs/canvas` and asserts on them, and drives the same reducer the UI uses.
Fixtures and build output are created on demand and removed afterwards, so the
working tree stays clean.

The health endpoint is available at `/api/health`. It returns HTTP 503 when required production configuration or database connectivity is unavailable.

## Production deployment

- Set every required variable documented in `.env.example`.
- Run `npm run db:migrate` as a release step before starting a new application version.
- Build with `npm run build` and start with `npm start`.
- Configure the Stripe webhook endpoint as `/api/stripe/webhook`.
- Terminate TLS at the hosting platform or reverse proxy. Security headers are emitted by Next.js.

## ImagePilot editor

The editor is a single reusable foundation rather than a collection of separate
tools. Planned features (background remover, screenshot editor, passport photo,
watermark studio and so on) are entry points into this same editor with a
task-specific starting state, so they inherit layers, history and export
without reimplementing any of it.

`src/lib/imagepilot` is organised so nothing but `raster.ts` touches the DOM:

| Module | Responsibility |
| --- | --- |
| `types.ts` | Document, layer and adjustment model |
| `constants.ts` | Limits, presets and descriptor tables |
| `adjustments.ts` | Pixel pipeline for all 17 image operations |
| `document.ts` | Pure layer and canvas operations |
| `geometry.ts` | Viewport, transform handles, snapping, rulers |
| `history.ts` | Snapshot undo/redo with coalescing |
| `renderer.ts` | Canvas compositor and text layout |
| `export.ts` | Raster compositing and SVG serialisation |
| `editor-state.ts` | Reducer owning history, selection and tools |
| `workspaces.ts` | Task configurations layered over the one editor |
| `watermark.ts` | Watermark layer generation, including tiling |
| `passport.ts` | ID photo specifications, guides and print sheets |
| `compress.ts` | Quality and target-size compression |
| `segmentation.ts` | Background matting, brush refinement |
| `regions.ts` | Region obscuring for redaction |
| `metadata.ts` | EXIF/XMP/ICC parsing and lossless removal |
| `convert.ts` | Batch conversion, BMP encoding, ZIP packaging |
| `raster.ts` | Browser-only: decoding, clipboard, downloads |

Design decisions worth knowing:

- **Bitmaps live outside the document.** Layers reference a `sourceId` into a
  raster store, so a history snapshot is a few kilobytes of JSON regardless of
  how many megapixels are loaded, and undo never copies pixel data.
- **History is snapshot-based, not command-based.** Because every document
  operation is pure, a snapshot is simply the previous return value. This
  removes the class of bugs where an inverse operation fails to exactly undo
  its forward counterpart. Consecutive edits sharing a merge key coalesce, so a
  slider drag is one undo step rather than a hundred.
- **Adjustments are collapsed into two passes.** Exposure, gamma, brightness,
  contrast, shadows, highlights, temperature and tint compile into one lookup
  table per channel; saturation, hue, grayscale, sepia and invert compose into a
  single 3×4 colour matrix. A full-frame edit therefore costs two passes rather
  than a dozen, which is what keeps slider dragging interactive.
- **The pipeline does not use CSS `filter`.** Support is inconsistent, absent in
  workers, and several required operations (gamma, shadows, highlights,
  temperature, threshold, noise reduction) have no CSS equivalent at all.
- **Blur premultiplies alpha** so transparent pixels cannot bleed dark fringes
  into visible edges, and **noise reduction uses a median filter** so it removes
  speckle without the edge smearing a mean filter causes.
- **The canvas is split in two.** The scene layer redraws only when the document
  changes; the overlay layer carries selection, handles and guides and redraws
  on every pointer move. A large document is therefore not recomposited sixty
  times a second just to move a selection rectangle.
- **SVG export is genuinely vector.** Shapes and text become real `<path>` and
  `<text>` elements using the same geometry the canvas renderer uses; only
  photo layers are embedded as bitmaps.

### One editor, several tools

The Screenshot Editor, Watermark Studio, Passport Photo Studio and Image
Compressor are *workspaces*: descriptors in `workspaces.ts` that declare which
tools to surface, which inspector panels to show and how an imported image is
staged. `ImageEditor` takes a workspace as a prop and the default is the full
editor, so `/imagepilot` behaves exactly as before. There is one canvas, one
history stack, one renderer and one exporter behind all five.

Consequences worth noting:

- **Watermarks are ordinary layers**, not painted pixels, so they can be
  nudged, restyled and undone like anything else — and the batch runner is
  simply "build these layers over each image and composite".
- **Passport guides are locked layers** rather than a bespoke overlay, so the
  existing renderer draws them with no special-casing. They are stripped
  automatically before any export.
- **Pixelate is a separate operation from blur** because averaging into blocks
  is irreversible, whereas a blur can often be undone by deconvolution. That
  distinction is the whole point when the operation is used to hide something.
- **Target-size compression is a binary search** over quality: encode, measure,
  adjust. The relationship between quality and file size is image-dependent, so
  a guessed quality value cannot hit a byte budget reliably. Eight encodes
  resolve it to within one quality point, and the result is the *highest*
  quality that fits rather than the first one that happens to.

### Background removal without a model

No ML model is used: none can be fetched at runtime in an offline,
privacy-first product, and shipping one would dwarf the application. Instead
`segmentation.ts` implements a classical matting pipeline — border sampling,
distance scoring, a trimap, an inward flood fill, then fractional alpha across
the uncertain band. The flood fill is what stops an enclosed region that merely
*resembles* the backdrop from being punched out, and the fractional band is
what preserves hair instead of producing a cut-out sticker. A brush is provided
because automatic detection will always miss something.

The sampler deliberately does more than count border colours. In almost every
portrait the subject's shoulders run off the bottom edge, so a naive count
learns the shirt as "background" and deletes the body. Clusters are scored by
how many edges they touch and whether they reach the corners, and a colour
confined to one edge with no corner presence is rejected outright.

### Redaction errs outward

`regions.ts` grows every region beyond the box the user dragged, and fits an
aspect-ratio preset by growing rather than preserving area. People drag
approximately; stopping a few pixels short of a licence plate leaves the digits
legible. Over-covering costs a little background, under-covering defeats the
tool. Pixelation is the default for faces and plates because averaging into
blocks is irreversible, whereas a light blur can sometimes be partly recovered
by deconvolution — the UI says so.

### Metadata removal is lossless

`metadata.ts` reads and rewrites the container bytes (JPEG APPn segments, PNG
chunks, RIFF chunks) rather than going through a canvas. Re-encoding would both
recompress the image and discard the metadata silently, without ever telling
the user what was in it. The compressed image data is copied verbatim, so a
cleaned JPEG is bit-identical in its scan data. The ICC colour profile is
retained by default because dropping it changes how the image displays.

### Format support is probed, not assumed

`canvas.toBlob` silently falls back to PNG for a type the browser cannot
encode, so the converter asks the browser what it can actually produce and only
offers those formats. BMP has no canvas encoder at all and is written directly.
TIFF is accepted as input but not offered as output: no browser can encode it,
and a hand-rolled encoder would produce files real TIFF readers reject.

## Document conversion

Four converters run entirely in the browser, so documents are never uploaded:

| Tool | Route |
| --- | --- |
| PDF to Word | `/tools/pdf-to-word` |
| Word to PDF | `/tools/word-to-pdf` |
| PDF to PowerPoint | `/tools/pdf-to-powerpoint` |
| PowerPoint to PDF | `/tools/powerpoint-to-pdf` |
| PDF to Excel | `/tools/pdf-to-excel` |
| Excel to PDF | `/tools/excel-to-pdf` |
| PDF to JPG or PNG | `/tools/pdf-to-image` |
| JPG or PNG to PDF | `/tools/image-to-pdf` |
| Fill PDF Forms | `/tools/pdf-forms` |
| Page Numbers | `/tools/page-numbers` |
| Crop PDF | `/tools/crop-pdf` |
| Redact PDF | `/tools/redact-pdf` |
| OCR PDF | `/tools/ocr-pdf` |
| Scan to PDF | `/tools/scan-to-pdf` |
| Compare PDF | `/tools/compare-pdf` |
| PDF/A Converter | `/tools/pdfa-converter` |

The conversion core in `src/lib/conversion` is deliberately free of DOM APIs so
the same modules power the browser tools and the Node test suite. PDF pages are
parsed into positioned text and images, analysed into paragraphs, headings,
lists and tables, then written as real OOXML or laid out onto PDF pages.

### Text quality detection

Not every PDF has text that can be read. Government forms, revenue records and
older Hindi documents often draw text with legacy 8-bit fonts (Kruti Dev,
DevLys, Chanakya) that map byte values to glyph shapes: "भारत सरकार" is stored
as `Hkkjr ljdkj`. Those bytes are valid ASCII, so a naive validity check passes
and a converter would emit a document full of garbage.

Every PDF conversion therefore runs a pre-flight check (`analyze-pdf.ts`) that
combines several independent signals — known legacy font families, missing
embedded font programs, absent ToUnicode maps, glyph-garbage word shapes,
invalid Unicode ratios and image-only pages. The result drives a badge in the
UI:

- **✓ Native Conversion** — the text layer is readable; the fast in-browser
  converter runs.
- **OCR Required** — the text cannot be trusted. Conversion is blocked and the
  user is told OCR is needed, instead of receiving a broken file.

The same gate is enforced inside the converters themselves, so no caller can
produce a corrupted document.

### Redaction

Redaction is implemented as a genuine removal, not a visual cover-up. For every
marked area PDFPilot locates the glyphs with pdf.js, rewrites the page content
stream with those text-showing operators deleted, draws an opaque box, flattens
interactive content and strips document metadata. The redacted characters are
gone from the file itself, so they cannot be copied out or recovered by reading
the raw stream — a property the test suite asserts against the output bytes.

### OCR

Optical character recognition uses Tesseract, with the engine, its WebAssembly
core and every language model vendored into `public/tesseract`. Nothing is
fetched from a CDN, so recognition works offline and no page image leaves the
browser — which matters most for exactly the scanned documents people are least
willing to upload. English, Hindi, French, German and Spanish are included and
can be combined for pages that mix scripts.

The output is a searchable PDF: the original page image is kept and an
invisible text layer (PDF text render mode 3) is positioned over the recognised
words, so the document looks unchanged but can be searched, selected and
copied.

### Pluggable conversion engines

`src/lib/conversion/engines` defines a `ConversionEngine` interface and a
registry. The UI only ever asks the registry which engine to use, so OCR
backends (Tesseract, PaddleOCR, Google Vision, Azure) can be added later
without touching any UI code. Selection prefers privacy-preserving engines
first, then the fastest, which keeps readable PDFs on the fast native path.

pdf.js standard fonts and CMaps are vendored into `public/pdfjs` so embedded
and CJK fonts resolve correctly without network access.

## Blog administration

The blog CMS is available to administrators at `/admin/posts`. It stores posts, categories, tags, SEO metadata, publication state, and contact messages in PostgreSQL.

Create or promote the first administrator after migrations have run:

```bash
ADMIN_EMAIL="keshavchouchan78@gmail.com" \
ADMIN_NAME="Keshav" \
ADMIN_PASSWORD="choose-a-unique-12-character-password" \
npm run admin:create
```

Then sign in through `/login?callbackUrl=/admin/posts`. Do not keep `ADMIN_PASSWORD` in a deployed environment after the account has been created. Administrators can create, edit, publish, search, and delete posts from the CMS.

Blog images are validated, resized, and converted to WebP during upload. Set `BLOB_READ_WRITE_TOKEN` for durable Vercel Blob storage in production. Self-hosted Node deployments without a token store images under `public/uploads/blog`; that directory must be backed by persistent storage. Vercel deployments intentionally reject local image writes when the Blob token is missing.

## Company

PDFPilot is built by Keshav Labs, a remote company based in Babarpur, Delhi, India. Public and support enquiries can be sent to `launchstack.in@gmail.com`.

Never commit `.env` files, database credentials, administrator passwords, OAuth secrets, or Stripe keys.

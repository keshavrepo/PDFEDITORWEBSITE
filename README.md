# PDFPilot

PDFPilot is a Next.js application for securely processing PDF documents in the browser, managing user accounts, and offering subscription-backed limits. PDF operations that do not require server capabilities stay on the user's device.

## Architecture

- **Web:** Next.js App Router, React, TypeScript, Tailwind CSS
- **Authentication:** NextAuth JWT sessions with credentials and optional Google OAuth
- **Persistence:** PostgreSQL, Drizzle ORM, versioned SQL migrations
- **PDF processing:** `pdf-lib` and `pdfjs-dist` in client components
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

Document conversion has its own end-to-end suite that runs the production
converters against generated Word, PowerPoint and PDF fixtures:

```bash
npm run test:conversions
```

Fixtures are created on demand and removed afterwards, so the working tree
stays clean.

The health endpoint is available at `/api/health`. It returns HTTP 503 when required production configuration or database connectivity is unavailable.

## Production deployment

- Set every required variable documented in `.env.example`.
- Run `npm run db:migrate` as a release step before starting a new application version.
- Build with `npm run build` and start with `npm start`.
- Configure the Stripe webhook endpoint as `/api/stripe/webhook`.
- Terminate TLS at the hosting platform or reverse proxy. Security headers are emitted by Next.js.

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

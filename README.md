# PDFPilot

PDFPilot is a Next.js application for securely processing PDF documents in the browser, managing user accounts, and offering subscription-backed limits. PDF operations that do not require server capabilities stay on the user's device.

## Architecture

- **Web:** Next.js App Router, React, TypeScript, Tailwind CSS
- **Authentication:** NextAuth JWT sessions with credentials and optional Google OAuth
- **Persistence:** PostgreSQL, Drizzle ORM, versioned SQL migrations
- **PDF processing:** `pdf-lib` and `pdfjs-dist` in client components
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

The health endpoint is available at `/api/health`. It returns HTTP 503 when required production configuration or database connectivity is unavailable.

## Production deployment

- Set every required variable documented in `.env.example`.
- Run `npm run db:migrate` as a release step before starting a new application version.
- Build with `npm run build` and start with `npm start`.
- Configure the Stripe webhook endpoint as `/api/stripe/webhook`.
- Terminate TLS at the hosting platform or reverse proxy. Security headers are emitted by Next.js.

Never commit `.env` files, database credentials, OAuth secrets, or Stripe keys.

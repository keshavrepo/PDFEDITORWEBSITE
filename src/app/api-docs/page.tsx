import type { Metadata } from "next";
import { ContentList, ContentPage } from "@/components/content-page";
import { getSession } from "@/lib/auth";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "API Docs | PDFPilot",
  description: "PDFPilot HTTP endpoint documentation and integration availability.",
};

function Code({ children }: { children: string }) {
  return <code className="block overflow-x-auto rounded-lg bg-muted p-4 text-xs sm:text-sm text-foreground whitespace-pre">{children}</code>;
}

export default async function ApiDocsPage() {
  const user = await getSession();
  return (
    <ContentPage
      user={user}
      eyebrow="Developers"
      title="API documentation"
      description="PDFPilot currently exposes operational and website endpoints. Document processing remains browser-first; a hosted document-processing API is not publicly available yet."
      sections={[
        {
          title: "Health check",
          content: <><p><strong className="text-foreground">GET /api/health</strong> reports configuration and database availability. Monitoring systems should treat HTTP 200 as healthy and HTTP 503 as unavailable.</p><Code>{`curl "$PDFPILOT_URL/api/health"\n\n{\n  "ok": true,\n  "service": "pdfpilot",\n  "checks": { "configuration": { "ok": true }, "database": { "ok": true } }\n}`}</Code></>,
        },
        {
          title: "Contact submission",
          content: <><p><strong className="text-foreground">POST /api/contact</strong> accepts website support enquiries as JSON. Browser requests are origin-checked and rate-limited.</p><Code>{`{\n  "firstName": "Keshav",\n  "lastName": "Kumar",\n  "email": "launchstack.in@gmail.com",\n  "message": "How can I use PDFPilot with my team?"\n}`}</Code></>,
        },
        {
          title: "Authentication",
          content: <p>Account and admin endpoints use secure PDFPilot session cookies and are intended for the first-party web application. They are not API-key endpoints and should not be integrated into external applications.</p>,
        },
        {
          title: "Future API access",
          content: <><p>Teams interested in a supported processing API can contact <a className="text-foreground underline underline-offset-4" href={`mailto:${siteConfig.publicEmail}`}>{siteConfig.publicEmail}</a>. We will only describe an endpoint as public after authentication, limits, versioning, and support commitments are in place.</p><ContentList><li>JSON responses use standard HTTP status codes.</li><li>Do not automate browser-authenticated private endpoints.</li><li>No public API key is currently required or issued.</li></ContentList></>,
        },
      ]}
    />
  );
}

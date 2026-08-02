import type { Metadata } from "next";
import { ContentList, ContentPage } from "@/components/content-page";
import { getSession } from "@/lib/auth";
import { siteConfig } from "@/lib/site";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  path: "/cookies",
  title: "Cookie Policy",
  description: "Cookies and browser storage used by LaunchStack.",
});

export default async function CookiesPage() {
  const user = await getSession();
  return (
    <ContentPage
      user={user}
      eyebrow={`Last updated ${siteConfig.legalUpdated}`}
      title="Cookie Policy"
      description="This policy describes the limited cookies and local browser storage PDFPilot uses to operate securely."
      sections={[
        { title: "Essential cookies", content: <p>PDFPilot uses authentication and security cookies to keep you signed in, protect sign-in flows, and prevent cross-site request forgery. These cookies are necessary for requested account features and cannot be disabled within the application.</p> },
        { title: "Browser preferences", content: <p>Your light or dark theme preference may be stored in local browser storage. PDF processing results may also exist temporarily in browser memory until you download them or close the page.</p> },
        { title: "Third-party services", content: <ContentList><li>Google may set cookies when you choose Google sign-in.</li><li>Stripe may set cookies on its hosted checkout and billing pages for fraud prevention and payment processing.</li><li>Those providers apply their own privacy and cookie policies on their domains.</li></ContentList> },
        { title: "Analytics and advertising", content: <p>PDFPilot does not currently use advertising cookies or cross-site behavioral advertising. If optional analytics are introduced, this policy and any required consent controls will be updated before they are enabled.</p> },
        { title: "Managing cookies", content: <p>You can delete or block cookies in your browser settings. Blocking essential cookies will prevent sign-in, account settings, admin access, and billing flows from working correctly. Questions can be sent to <a className="text-foreground underline" href={`mailto:${siteConfig.publicEmail}`}>{siteConfig.publicEmail}</a>.</p> },
      ]}
    />
  );
}

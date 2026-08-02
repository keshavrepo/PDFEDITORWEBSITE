import type { Metadata } from "next";
import { ContentList, ContentPage } from "@/components/content-page";
import { getSession } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
  path: "/privacy",
  title: "Privacy Policy",
  description: "How Keshav Labs collects, uses, and protects LaunchStack data.",
});

export default async function PrivacyPage() {
  const user = await getSession();
  return (
    <ContentPage
      user={user}
      eyebrow={`Last updated ${siteConfig.legalUpdated}`}
      title="Privacy Policy"
      description={`${siteConfig.company} operates ${siteConfig.name}. This policy explains the personal data we process when you use the website.`}
      sections={[
        { title: "Information we collect", content: <ContentList><li>Account details such as email address, display name, profile image, plan, and authentication records.</li><li>Contact submissions, including your name, email address, message, status, and submission time.</li><li>Limited processing history and technical security logs, such as tool name, file sizes, status, IP address, and user agent. We do not need the document contents for browser-side operations.</li><li>Billing identifiers and subscription status from Stripe. PDFPilot does not receive or store complete payment-card numbers.</li></ContentList> },
        { title: "Document processing", content: <p>Supported PDF operations run in your browser. The selected document and generated result remain on your device unless a feature clearly tells you otherwise before upload. Account history may record operational metadata, but not the contents of locally processed documents.</p> },
        { title: "How we use information", content: <ContentList><li>Provide accounts, support, billing, and requested services.</li><li>Secure the service, prevent abuse, and diagnose failures.</li><li>Respond to enquiries and meet legal obligations.</li><li>Improve product reliability using limited operational information.</li></ContentList> },
        { title: "Service providers and disclosure", content: <p>We use infrastructure providers necessary to host the website, PostgreSQL for application data, Stripe for billing, Google when you choose Google sign-in, and Resend when email delivery is configured. We do not sell personal information. We may disclose information when legally required or necessary to protect users and the service.</p> },
        { title: "Retention and security", content: <p>We keep account and transaction records while your account is active and as required for legal, fraud-prevention, and accounting purposes. Contact records are retained while needed for support. Reasonable technical and organizational controls are used, but no internet service can guarantee absolute security.</p> },
        { title: "Your choices", content: <p>You may update profile information, change your password, manage billing, or delete your account from Settings. You can request access, correction, or deletion by emailing <a className="text-foreground underline" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>. Some records may be retained where law requires it.</p> },
        { title: "Contact", content: <p>Privacy enquiries may be sent to {siteConfig.company}, {siteConfig.location}, at <a className="text-foreground underline" href={`mailto:${siteConfig.publicEmail}`}>{siteConfig.publicEmail}</a>.</p> },
      ]}
    />
  );
}

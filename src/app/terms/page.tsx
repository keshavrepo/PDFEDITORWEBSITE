import type { Metadata } from "next";
import { ContentList, ContentPage } from "@/components/content-page";
import { getSession } from "@/lib/auth";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service | PDFPilot",
  description: "Terms governing use of PDFPilot by Keshav Labs.",
};

export default async function TermsPage() {
  const user = await getSession();
  return (
    <ContentPage
      user={user}
      eyebrow={`Effective ${siteConfig.legalUpdated}`}
      title="Terms of Service"
      description={`These terms govern your use of ${siteConfig.name}, a service provided by ${siteConfig.company} in Delhi, India.`}
      sections={[
        { title: "Acceptance and eligibility", content: <p>By accessing PDFPilot, you agree to these terms and the Privacy Policy. You must have legal capacity to enter this agreement. If you use PDFPilot for an organization, you confirm that you are authorized to bind it.</p> },
        { title: "Permitted use", content: <ContentList><li>Use the service only for documents you own or are authorized to process.</li><li>Do not violate law, intellectual-property rights, privacy rights, or contractual restrictions.</li><li>Do not disrupt, reverse engineer, scrape, overload, or bypass security and usage controls.</li><li>Do not use PDFPilot to distribute malware, fraud, abuse, or unlawful content.</li></ContentList> },
        { title: "Accounts", content: <p>You are responsible for accurate account information, password confidentiality, and activity under your account. Notify us promptly if you suspect unauthorized access. We may suspend access when reasonably necessary to protect the service or enforce these terms.</p> },
        { title: "Subscriptions and cancellation", content: <p>Paid plans renew according to the price and billing period shown at checkout. Stripe processes payments. You may cancel through the billing portal; cancellation normally takes effect at the end of the current paid period unless checkout terms state otherwise. Taxes may apply.</p> },
        { title: "Your documents", content: <p>You retain rights in your documents. You grant only the limited rights necessary to provide a feature you request. For local browser processing, PDFPilot does not receive the document bytes. You are responsible for reviewing generated output before relying on it.</p> },
        { title: "Availability and disclaimer", content: <p>We work to keep PDFPilot reliable but provide the service on an “as available” basis. Software output can contain errors and is not legal, financial, or professional advice. To the extent permitted by law, implied warranties are disclaimed.</p> },
        { title: "Liability", content: <p>To the extent permitted by applicable law, Keshav Labs is not liable for indirect, incidental, special, consequential, or lost-profit damages arising from PDFPilot. Any aggregate direct liability is limited to the amount you paid for the service during the three months before the event giving rise to the claim.</p> },
        { title: "Governing law and contact", content: <p>These terms are governed by the laws of India. Courts with jurisdiction in Delhi will have exclusive jurisdiction, subject to mandatory consumer protections. Questions may be sent to <a className="text-foreground underline" href={`mailto:${siteConfig.publicEmail}`}>{siteConfig.publicEmail}</a>.</p> },
      ]}
    />
  );
}

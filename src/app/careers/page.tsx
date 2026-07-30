import type { Metadata } from "next";
import { ContentList, ContentPage } from "@/components/content-page";
import { getSession } from "@/lib/auth";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Careers | Keshav Labs",
  description: "Career information for Keshav Labs, the company behind PDFPilot.",
};

export default async function CareersPage() {
  const user = await getSession();
  return (
    <ContentPage
      user={user}
      eyebrow="Keshav Labs"
      title="Careers"
      description="We are a small remote company in India focused on useful, privacy-conscious software."
      sections={[
        { title: "Current openings", content: <p>There are no open positions at this time. This page is the authoritative source for Keshav Labs vacancies; we do not ask candidates to pay fees or purchase equipment during recruitment.</p> },
        { title: "What we value", content: <ContentList><li>Clear thinking and straightforward communication.</li><li>Respect for customer privacy and security.</li><li>Reliable engineering over unnecessary complexity.</li><li>Ownership, curiosity, and thoughtful remote collaboration.</li></ContentList> },
        { title: "Future opportunities", content: <p>You may send a concise introduction and portfolio link to <a className="text-foreground underline underline-offset-4" href={`mailto:${siteConfig.founderEmail}`}>{siteConfig.founderEmail}</a>. Unsolicited applications are retained only as needed to respond and do not guarantee consideration for a future role.</p> },
      ]}
    />
  );
}

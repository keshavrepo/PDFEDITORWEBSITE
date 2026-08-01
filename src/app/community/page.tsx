import type { Metadata } from "next";
import Link from "next/link";
import { ContentList, ContentPage } from "@/components/content-page";
import { getSession } from "@/lib/auth";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Community | PDFPilot",
  description: "Connect with PDFPilot and Keshav Labs.",
};

export default async function CommunityPage() {
  const user = await getSession();
  return (
    <ContentPage
      user={user}
      eyebrow="Community"
      title="Build better document workflows together"
      description="PDFPilot grows through practical feedback from people who work with documents every day."
      sections={[
        { title: "Join the conversation", content: <ContentList><li>Follow repositories and product work on <Link className="text-foreground underline" href={siteConfig.github} target="_blank">GitHub</Link>.</li><li>Connect with founder Keshav on <Link className="text-foreground underline" href={siteConfig.linkedin} target="_blank">LinkedIn</Link>.</li><li>Share workflow feedback through the <Link className="text-foreground underline" href="/contact">contact page</Link>.</li></ContentList> },
        { title: "Report an issue", content: <p>For product defects, include the tool name, browser version, steps to reproduce, and the visible error. Never attach a confidential source document; a safe sample file is sufficient when one is needed.</p> },
        { title: "Community standards", content: <p>Be respectful, protect personal and document data, and keep reports constructive. Security vulnerabilities should be sent privately to <a className="text-foreground underline" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>, not posted publicly.</p> },
      ]}
    />
  );
}

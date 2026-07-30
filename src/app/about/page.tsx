import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { getSession } from "@/lib/auth";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "About | PDFPilot",
  description: "About PDFPilot, Keshav Labs, and founder Keshav in Delhi, India.",
};

export default async function AboutPage() {
  const user = await getSession();
  return (
    <ContentPage
      user={user}
      eyebrow="Company"
      title={`About ${siteConfig.name}`}
      description={`${siteConfig.name} is a document productivity product created by ${siteConfig.company}, a remote company based in ${siteConfig.location}.`}
      sections={[
        {
          title: "Our purpose",
          content: <p>We build straightforward software that helps people complete everyday document work without complicated installations or unnecessary transfers of private files.</p>,
        },
        {
          title: "Founder",
          content: <p>{siteConfig.name} was founded by {siteConfig.founder}. Product direction, engineering, and customer experience are led from Delhi, India. Founder enquiries can be sent to <a className="text-foreground underline underline-offset-4" href={`mailto:${siteConfig.founderEmail}`}>{siteConfig.founderEmail}</a>.</p>,
        },
        {
          title: "How we work",
          content: <p>{siteConfig.company} operates as a remote company in India. We focus on privacy-conscious architecture, clear product communication, and responsive support rather than maintaining a public walk-in office.</p>,
        },
        {
          title: "Connect",
          content: <p>Follow development on <Link className="text-foreground underline underline-offset-4" href={siteConfig.github} target="_blank">GitHub</Link> or connect with Keshav on <Link className="text-foreground underline underline-offset-4" href={siteConfig.linkedin} target="_blank">LinkedIn</Link>.</p>,
        },
      ]}
    />
  );
}

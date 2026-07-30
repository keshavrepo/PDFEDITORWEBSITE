import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContentList, ContentPage } from "@/components/content-page";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Features | PDFPilot",
  description: "Private, browser-first PDF tools from PDFPilot by Keshav Labs.",
};

export default async function FeaturesPage() {
  const user = await getSession();
  return (
    <ContentPage
      user={user}
      eyebrow="Product"
      title="Professional PDF workflows without unnecessary uploads"
      description="PDFPilot combines practical document tools, account history, and secure billing in a fast, responsive workspace built by Keshav Labs."
      sections={[
        {
          title: "Private browser processing",
          content: <p>Supported PDF operations run locally in your browser. Your document bytes are not sent to PDFPilot merely to merge, organize, or optimize a file.</p>,
        },
        {
          title: "Organize and optimize",
          content: (
            <ContentList>
              <li>Merge documents in a chosen order.</li>
              <li>Split, rotate, remove, and reorder pages.</li>
              <li>Apply lossless structural compression and repair damaged PDF structures.</li>
              <li>Add text, signatures, watermarks, and password protection.</li>
            </ContentList>
          ),
        },
        {
          title: "Accounts and billing",
          content: <p>Create an account to keep processing history, manage profile and security settings, recover access, and manage a paid plan through Stripe&apos;s hosted billing portal.</p>,
        },
        {
          title: "Built for every screen",
          content: <p>The same tools work across modern desktop, tablet, and mobile browsers. Keyboard-accessible controls, clear processing feedback, and dark mode are included throughout the interface.</p>,
        },
      ]}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
        <div className="flex flex-wrap gap-3">
          <Button asChild><Link href="/tools">Explore tools</Link></Button>
          <Button variant="outline" asChild><Link href="/pricing">View pricing</Link></Button>
        </div>
      </div>
    </ContentPage>
  );
}

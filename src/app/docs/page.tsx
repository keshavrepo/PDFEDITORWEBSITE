import type { Metadata } from "next";
import Link from "next/link";
import { ContentList, ContentPage } from "@/components/content-page";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Documentation | PDFPilot",
  description: "Learn how to use PDFPilot tools, accounts, downloads, and billing.",
};

export default async function DocumentationPage() {
  const user = await getSession();
  return (
    <ContentPage
      user={user}
      eyebrow="Resources"
      title="PDFPilot documentation"
      description="A practical guide to processing documents, managing your account, and keeping your workflow private."
      sections={[
        {
          title: "Using a PDF tool",
          content: <ContentList><li>Open the <Link className="text-foreground underline" href="/tools">tools directory</Link> and choose an operation.</li><li>Select a supported file from your device and review its name and size.</li><li>Configure page ranges or options, then start processing.</li><li>Download the result before leaving the page.</li></ContentList>,
        },
        {
          title: "File privacy",
          content: <p>Browser-supported document operations execute on your device. Keep the tab open until processing and download finish. Results are held temporarily in browser memory and disappear when you close or refresh the page.</p>,
        },
        {
          title: "Accounts",
          content: <p>An account provides dashboard history, profile settings, password recovery, and billing controls. Open Settings to update your name, profile image, password, or subscription.</p>,
        },
        {
          title: "Troubleshooting",
          content: <ContentList><li>Confirm the file is a valid PDF and below the displayed size limit.</li><li>Unlock encrypted documents before using tools that need to read page content.</li><li>Use a current version of Chrome, Edge, Firefox, or Safari.</li><li>If a download is blocked, allow downloads for the PDFPilot site and retry.</li></ContentList>,
        },
      ]}
    />
  );
}

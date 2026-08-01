import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ToolsDirectory } from "@/components/pdfpilot/tools-directory";

export const metadata: Metadata = {
  title: "PDF Tools | PDFPilot by LaunchStack",
  description:
    "Private browser-based tools to convert, organize, optimize, edit, and secure PDFs. PDFPilot is the first product on the LaunchStack platform.",
};
export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const user = await getSession();
  return <><Navbar user={user} /><main><ToolsDirectory /></main><Footer /></>;
}

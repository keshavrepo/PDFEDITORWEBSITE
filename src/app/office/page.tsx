import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { OfficeWorkspace } from "@/components/office/workspace";

export const metadata: Metadata = {
  title: "OfficePilot | Professional Office Workspace",
  description: "Word, spreadsheet, presentation, and template workspace inside LaunchStack.",
};

export default function OfficePage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
        <section className="max-w-6xl mx-auto px-6 lg:px-8 pt-16 pb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">OfficePilot</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">One shared professional office workspace. Word processing, spreadsheets, presentations, and templates — integrated into LaunchStack.</p>
        </section>
        <section className="max-w-6xl mx-auto px-6 lg:px-8 pb-24">
          <OfficeWorkspace />
        </section>
      </main>
      <Footer />
    </>
  );
}

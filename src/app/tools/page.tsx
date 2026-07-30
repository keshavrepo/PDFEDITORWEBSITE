import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const user = await getSession();

  const toolCategories = [
    {
      name: "Convert from PDF",
      tools: [
        { name: "PDF to Word", description: "Convert to .docx", href: "/tools/pdf-to-word" },
        { name: "PDF to Excel", description: "Convert to .xlsx", href: "/tools/pdf-to-excel" },
        { name: "PDF to PowerPoint", description: "Convert to .pptx", href: "/tools/pdf-to-powerpoint" },
        { name: "PDF to Image", description: "Convert to JPG/PNG", href: "/tools/pdf-to-image" },
      ],
    },
    {
      name: "Convert to PDF",
      tools: [
        { name: "Word to PDF", description: "Convert from .docx", href: "/tools/word-to-pdf" },
        { name: "Excel to PDF", description: "Convert from .xlsx", href: "/tools/excel-to-pdf" },
        { name: "PowerPoint to PDF", description: "Convert from .pptx", href: "/tools/powerpoint-to-pdf" },
        { name: "Image to PDF", description: "Convert from JPG/PNG", href: "/tools/image-to-pdf" },
      ],
    },
    {
      name: "Organize",
      tools: [
        { name: "Merge PDF", description: "Combine multiple PDFs", href: "/tools/merge-pdf" },
        { name: "Split PDF", description: "Extract pages", href: "/tools/split-pdf" },
        { name: "Rotate PDF", description: "Rotate pages", href: "/tools/rotate-pdf" },
        { name: "Delete Pages", description: "Remove pages", href: "/tools/delete-pages" },
      ],
    },
    {
      name: "Optimize",
      tools: [
        { name: "Compress PDF", description: "Reduce file size", href: "/tools/compress-pdf" },
        { name: "Repair PDF", description: "Fix corrupted files", href: "/tools/repair-pdf" },
      ],
    },
    {
      name: "Edit",
      tools: [
        { name: "Edit PDF", description: "Add text and shapes", href: "/tools/edit-pdf" },
        { name: "Sign PDF", description: "Add signature", href: "/tools/sign-pdf" },
        { name: "Watermark", description: "Add watermark", href: "/tools/watermark-pdf" },
      ],
    },
    {
      name: "Security",
      tools: [
        { name: "Protect PDF", description: "Add password", href: "/tools/protect-pdf" },
        { name: "Unlock PDF", description: "Remove password", href: "/tools/unlock-pdf" },
      ],
    },
  ];

  return (
    <>
      <Navbar user={user} />
      
      <main>
        {/* Header */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              All Tools
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Everything you need to work with PDFs
            </p>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search tools..."
                className="pl-10"
              />
            </div>
          </div>
        </section>

        {/* Tools by Category */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="space-y-16">
            {toolCategories.map((category) => (
              <div key={category.name}>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
                  {category.name}
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {category.tools.map((tool) => (
                    <Link key={tool.name} href={tool.href}>
                      <Card className="p-5 hover:bg-accent transition-colors cursor-pointer group">
                        <h3 className="font-semibold mb-1 group-hover:translate-x-0.5 transition-transform">
                          {tool.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {tool.description}
                        </p>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

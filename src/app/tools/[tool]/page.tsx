import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { GenericPdfTool } from "@/components/generic-pdf-tool";
import { tools } from "@/lib/tools";
import { conversionToolMap } from "@/lib/conversion/tool-config";

interface ToolPageProps { params: Promise<{ tool: string }> }

/**
 * Tools that ship their own route segment. Static routes already win over this
 * dynamic one, but excluding them here keeps `generateMetadata` honest and
 * prevents the generic PDF tool from ever rendering a converter slug.
 */
const dedicatedRoutes = new Set<string>([
  "merge-pdf",
  "compress-pdf",
  "pdf-to-image",
  "image-to-pdf",
  ...conversionToolMap.keys(),
]);

function findTool(slug: string) {
  return tools.find((tool) => tool.href === `/tools/${slug}` && !dedicatedRoutes.has(tool.id));
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const tool = findTool((await params).tool);
  if (!tool) return { title: "Tool not found | PDFPilot" };
  return { title: `${tool.name} | PDFPilot`, description: `${tool.description} privately in your browser with PDFPilot.` };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const tool = findTool((await params).tool);
  if (!tool) notFound();
  return <><Navbar /><GenericPdfTool tool={tool} /><Footer /></>;
}

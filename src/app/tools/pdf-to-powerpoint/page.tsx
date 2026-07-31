import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ConversionToolPage,
  buildConversionMetadata,
} from "@/components/conversion-tool-page";
import { getConversionTool } from "@/lib/conversion/tool-config";

const tool = getConversionTool("pdf-to-powerpoint");

export const metadata: Metadata = tool
  ? buildConversionMetadata(tool)
  : { title: "Tool not found | PDFPilot" };

export default function Page() {
  if (!tool) notFound();
  return <ConversionToolPage tool={tool} />;
}

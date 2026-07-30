export type ToolCategory =
  | "Convert"
  | "Organize"
  | "Optimize"
  | "Edit"
  | "Security";

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  href: string;
  category: ToolCategory;
}

export const tools: ToolDefinition[] = [
  { id: "pdf-to-image", name: "PDF to Image", description: "Convert pages to PNG or JPG", href: "/tools/pdf-to-image", category: "Convert" },
  { id: "image-to-pdf", name: "Image to PDF", description: "Combine JPG and PNG images", href: "/tools/image-to-pdf", category: "Convert" },
  { id: "merge-pdf", name: "Merge PDF", description: "Combine multiple PDFs", href: "/tools/merge-pdf", category: "Organize" },
  { id: "split-pdf", name: "Split PDF", description: "Extract pages", href: "/tools/split-pdf", category: "Organize" },
  { id: "rotate-pdf", name: "Rotate PDF", description: "Rotate selected pages", href: "/tools/rotate-pdf", category: "Organize" },
  { id: "delete-pages", name: "Delete Pages", description: "Remove selected pages", href: "/tools/delete-pages", category: "Organize" },
  { id: "compress-pdf", name: "Compress PDF", description: "Reduce file size losslessly", href: "/tools/compress-pdf", category: "Optimize" },
  { id: "repair-pdf", name: "Repair PDF", description: "Recover and rebuild PDF structure", href: "/tools/repair-pdf", category: "Optimize" },
  { id: "edit-pdf", name: "Edit PDF", description: "Add text to a page", href: "/tools/edit-pdf", category: "Edit" },
  { id: "sign-pdf", name: "Sign PDF", description: "Add a visual signature", href: "/tools/sign-pdf", category: "Edit" },
  { id: "watermark-pdf", name: "Watermark", description: "Add a text watermark", href: "/tools/watermark-pdf", category: "Edit" },
  { id: "protect-pdf", name: "Protect PDF", description: "Encrypt with a password", href: "/tools/protect-pdf", category: "Security" },
  { id: "unlock-pdf", name: "Unlock PDF", description: "Remove password encryption", href: "/tools/unlock-pdf", category: "Security" },
];

export const toolIds = new Set(tools.map((tool) => tool.id));

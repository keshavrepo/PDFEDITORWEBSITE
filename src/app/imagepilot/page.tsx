import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ImagePilotEditor } from "@/components/imagepilot/editor-shell";

export const metadata: Metadata = {
  title: "ImagePilot Editor | Professional Image Editing",
  description: "Professional browser-based image editor with compare, color tools, export presets, EXIF viewer, and print studio.",
};

export default function ImagePilotPage() {
  return (
    <>
      <Navbar />
      <ImagePilotEditor />
      <Footer />
    </>
  );
}

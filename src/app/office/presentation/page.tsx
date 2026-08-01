import { Metadata } from "next";
import { PresentationEditor } from "@/components/office/presentation-editor";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
export const metadata: Metadata = { title: "Presentation Editor | OfficePilot" };
export default function PresentationPage() { return (<><Navbar /><main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30"><section className="max-w-6xl mx-auto px-6 lg:px-8 pt-16 pb-12"><h1 className="text-3xl font-bold mb-6">Presentation Editor</h1><PresentationEditor /></section></main><Footer /></>); }

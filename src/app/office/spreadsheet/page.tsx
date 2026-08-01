import { Metadata } from "next";
import { SpreadsheetEditor } from "@/components/office/spreadsheet-editor";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
export const metadata: Metadata = { title: "Spreadsheet Editor | OfficePilot" };
export default function SpreadsheetPage() { return (<><Navbar /><main className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/30"><section className="max-w-6xl mx-auto px-6 lg:px-8 pt-16 pb-12"><h1 className="text-3xl font-bold mb-6">Spreadsheet Editor</h1><SpreadsheetEditor /></section></main><Footer /></>); }

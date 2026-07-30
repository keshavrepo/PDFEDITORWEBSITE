import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PDFPilot - Premium PDF Tools Online",
  description: "Transform, edit, convert, and manage your PDFs with professional-grade tools. Fast, secure, and easy to use.",
  keywords: ["PDF", "PDF tools", "PDF converter", "PDF editor", "merge PDF", "compress PDF"],
  authors: [{ name: "PDFPilot" }],
  openGraph: {
    title: "PDFPilot - Premium PDF Tools Online",
    description: "Transform, edit, convert, and manage your PDFs with professional-grade tools.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

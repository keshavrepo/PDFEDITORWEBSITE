import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { FileManager } from "@/components/platform/file-manager";
import { getStorageSummary, listFiles } from "@/lib/platform/files";
import { platform } from "@/lib/products";

export const metadata: Metadata = {
  title: `Files | ${platform.name}`,
  description:
    "One file history shared across every LaunchStack product. Search, rename, favourite and manage everything you have processed.",
};

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const user = await getSession();
  if (!user) redirect("/login?callbackUrl=/files");

  const [files, storage] = await Promise.all([
    listFiles(user.id, { limit: 100 }),
    getStorageSummary(user.id),
  ]);

  return (
    <>
      <Navbar user={user} />
      <main>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground font-medium" aria-current="page">
                Files
              </li>
            </ol>
          </nav>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">Files</h1>
          <p className="text-muted-foreground">
            Everything you have processed across LaunchStack, in one place.
          </p>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <FileManager
            initialFiles={files}
            // Only offer filters for products that actually have files.
            productFilters={storage.byProduct.map((entry) => ({
              id: entry.productId,
              name: entry.productName,
            }))}
          />
        </section>
      </main>
      <Footer />
    </>
  );
}

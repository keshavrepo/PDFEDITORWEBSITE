import type { ReactNode } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <>
      <Navbar user={admin} />
      <div className="min-h-screen pt-16">
        <div className="border-b bg-muted/30">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-5 text-sm">
            <span className="font-semibold">Content admin</span>
            <Link href="/admin/posts" className="text-muted-foreground hover:text-foreground">Posts</Link>
            <Link href="/admin/posts/new" className="text-muted-foreground hover:text-foreground">New post</Link>
            <Link href="/admin/messages" className="text-muted-foreground hover:text-foreground">Messages</Link>
            <Link href="/blog" className="text-muted-foreground hover:text-foreground">View blog</Link>
          </nav>
        </div>
        {children}
      </div>
      <Footer />
    </>
  );
}

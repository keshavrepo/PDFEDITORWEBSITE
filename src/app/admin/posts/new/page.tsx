import { asc } from "drizzle-orm";
import { AdminPostForm } from "@/components/admin-post-form";
import { db } from "@/db";
import { blogCategories } from "@/db/schema";

export default async function NewPostPage() {
  const categories = await db.select({ name: blogCategories.name }).from(blogCategories).orderBy(asc(blogCategories.name));
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8"><h1 className="text-3xl font-bold">Create post</h1><p className="text-muted-foreground mt-1">Write and publish a new PDFPilot article.</p></div>
      <AdminPostForm categories={categories.map((category) => category.name)} />
    </main>
  );
}

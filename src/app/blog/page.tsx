import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const user = await getSession();

  const posts = [
    {
      title: "10 PDF Productivity Hacks",
      excerpt: "Time-saving techniques for working with PDFs that will transform your workflow.",
      date: "Mar 15, 2024",
      readTime: "5 min",
    },
    {
      title: "How to Compress PDFs Without Losing Quality",
      excerpt: "The best techniques for reducing file size while maintaining clarity.",
      date: "Mar 12, 2024",
      readTime: "8 min",
    },
    {
      title: "PDF Security Best Practices",
      excerpt: "Protect your sensitive documents with these essential security measures.",
      date: "Mar 10, 2024",
      readTime: "6 min",
    },
    {
      title: "Converting PDFs to Word: Complete Guide",
      excerpt: "Everything you need to know about converting PDF documents to Word files.",
      date: "Mar 8, 2024",
      readTime: "7 min",
    },
    {
      title: "Why Digital Documents Are the Future",
      excerpt: "How digital transformation is changing the way we work with documents.",
      date: "Mar 5, 2024",
      readTime: "10 min",
    },
    {
      title: "Merge vs. Split: When to Use Each Tool",
      excerpt: "Understanding the right tool for your PDF organization needs.",
      date: "Mar 1, 2024",
      readTime: "4 min",
    },
  ];

  return (
    <>
      <Navbar user={user} />
      
      <main>
        {/* Header */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Blog
            </h1>
            <p className="text-lg text-muted-foreground">
              Tips, tutorials, and insights for working with PDFs
            </p>
          </div>
        </section>

        {/* Featured Post */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <Link href={`/blog/${posts[0].title.toLowerCase().replace(/\s+/g, '-')}`}>
            <Card className="p-8 hover:bg-accent transition-colors cursor-pointer">
              <div className="max-w-3xl">
                <p className="text-sm text-muted-foreground mb-2">Featured</p>
                <h2 className="text-2xl md:text-3xl font-bold mb-3">
                  {posts[0].title}
                </h2>
                <p className="text-muted-foreground mb-4">
                  {posts[0].excerpt}
                </p>
                <div className="flex items-center text-sm text-muted-foreground">
                  <span>{posts[0].date}</span>
                  <span className="mx-2">·</span>
                  <span>{posts[0].readTime} read</span>
                </div>
              </div>
            </Card>
          </Link>
        </section>

        {/* Posts Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.slice(1).map((post) => (
              <Link
                key={post.title}
                href={`/blog/${post.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Card className="p-6 h-full hover:bg-accent transition-colors cursor-pointer">
                  <h3 className="font-semibold mb-2 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span>{post.date}</span>
                    <span className="mx-2">·</span>
                    <span>{post.readTime}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

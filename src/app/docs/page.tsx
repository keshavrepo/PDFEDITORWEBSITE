import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ArrowRight, BookOpen, Newspaper } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { blogCategories, blogPosts } from "@/db/schema";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { getAppUrl } from "@/lib/env";
import { platform } from "@/lib/products";
import {
  DOCUMENTATION_CATEGORY,
  documentationSections,
} from "@/lib/platform/documentation";

const description = `Documentation for ${platform.name}: getting started, using PDFPilot, managing files, privacy, account settings and troubleshooting.`;
const url = `${getAppUrl()}/docs`;

export const metadata: Metadata = {
  title: `Documentation | ${platform.name}`,
  description,
  keywords: ["LaunchStack documentation", "PDFPilot help", "guides", "how to"],
  alternates: { canonical: url },
  openGraph: {
    title: `Documentation | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
};

export const dynamic = "force-dynamic";

/**
 * Long-form guides written in the blog CMS.
 *
 * Filing an article under the Documentation category publishes it here with no
 * code change, so writers do not need a deploy to add a guide.
 */
async function loadGuides() {
  try {
    return await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        readingTime: blogPosts.readingTime,
      })
      .from(blogPosts)
      .innerJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .where(
        and(
          eq(blogPosts.status, "published"),
          eq(blogCategories.name, DOCUMENTATION_CATEGORY)
        )
      )
      .orderBy(desc(blogPosts.publishedAt))
      .limit(12);
  } catch {
    // The page must still render its static sections if the CMS is unreachable.
    return [];
  }
}

export default async function DocumentationPage() {
  const [user, guides] = await Promise.all([getSession(), loadGuides()]);

  return (
    <>
      <Navbar user={user} />
      <main className="min-h-screen">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground font-medium" aria-current="page">
                Documentation
              </li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-4">
              Resources
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-5">
              {platform.name} documentation
            </h1>
            <p className="text-lg text-muted-foreground">
              A practical guide to the platform: getting set up, working with products, managing
              your files and keeping your documents private.
            </p>
          </div>
        </section>

        {/* Section index */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documentationSections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                <Card className="p-5 h-full hover:bg-accent transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                    </div>
                    <h2 className="font-semibold group-hover:translate-x-0.5 transition-transform">
                      {section.title}
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {section.summary}
                  </p>
                </Card>
              </a>
            ))}
          </div>
        </section>

        {/* Sections */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-14">
          {documentationSections.map((section) => (
            <div key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-2xl font-bold mb-2">{section.title}</h2>
              <p className="text-muted-foreground mb-6">{section.summary}</p>

              <div className="space-y-3">
                {section.items.map((item) => {
                  const body = (
                    <Card
                      className={`p-5 ${item.href ? "hover:bg-accent transition-colors cursor-pointer group" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold mb-1">{item.label}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                        {item.href && (
                          <ArrowRight
                            className="h-4 w-4 shrink-0 mt-1 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </Card>
                  );

                  return item.href ? (
                    <Link key={item.label} href={item.href}>
                      {body}
                    </Link>
                  ) : (
                    <div key={item.label}>{body}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* CMS-authored guides */}
        {guides.length > 0 && (
          <section className="border-t bg-muted/30 py-16">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold mb-2">In-depth guides</h2>
              <p className="text-muted-foreground mb-8">
                Longer walkthroughs published by the {platform.name} team.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {guides.map((guide) => (
                  <Link key={guide.id} href={`/blog/${guide.slug}`}>
                    <Card className="p-5 h-full hover:bg-accent transition-colors cursor-pointer group">
                      <div className="flex items-center gap-2 mb-2">
                        <Newspaper className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        <span className="text-xs text-muted-foreground">
                          {guide.readingTime} min read
                        </span>
                      </div>
                      <h3 className="font-semibold mb-1 group-hover:translate-x-0.5 transition-transform">
                        {guide.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {guide.excerpt}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="p-8 text-center">
              <h2 className="text-xl font-bold mb-2">Cannot find what you need?</h2>
              <p className="text-muted-foreground mb-6">
                Search the whole platform with ⌘K, or get in touch and we will help.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Contact support
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Link>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

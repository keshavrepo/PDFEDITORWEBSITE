import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";

export interface ContentSection {
  title: string;
  content: ReactNode;
}

interface ContentPageProps {
  user: CurrentUser | null;
  eyebrow?: string;
  title: string;
  description: string;
  sections: ContentSection[];
  children?: ReactNode;
}

export function ContentPage({
  user,
  eyebrow,
  title,
  description,
  sections,
  children,
}: ContentPageProps) {
  return (
    <>
      <Navbar user={user} />
      <main className="min-h-screen">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-14">
          <div className="max-w-3xl">
            {eyebrow && (
              <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-4">
                {eyebrow}
              </p>
            )}
            <h1 className="text-4xl md:text-5xl font-bold mb-5">{title}</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </section>

        {children}

        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="space-y-6">
            {sections.map((section) => (
              <Card key={section.title} className="p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-semibold mb-4">
                  {section.title}
                </h2>
                <div className="text-sm sm:text-base text-muted-foreground leading-7 space-y-4">
                  {section.content}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export function ContentList({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-2">{children}</ul>;
}

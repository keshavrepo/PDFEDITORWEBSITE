import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { processingHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSession();
  
  if (!user) {
    redirect("/login");
  }

  const recentActivity = await db
    .select()
    .from(processingHistory)
    .where(eq(processingHistory.userId, user.id))
    .orderBy(desc(processingHistory.createdAt))
    .limit(5);

  const quickTools = [
    { name: "Merge PDF", href: "/tools/merge-pdf" },
    { name: "Compress PDF", href: "/tools/compress-pdf" },
    { name: "PDF to Word", href: "/tools/pdf-to-word" },
    { name: "Split PDF", href: "/tools/split-pdf" },
  ];

  return (
    <>
      <Navbar user={user} />
      
      <main>
        {/* Header */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {user.name || "User"}
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Files processed</p>
              <p className="text-2xl font-semibold">{recentActivity.length}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Storage used</p>
              <p className="text-2xl font-semibold">
                {((user.storageUsed || 0) / 1024 / 1024).toFixed(1)} MB
              </p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Current plan</p>
              <p className="text-2xl font-semibold capitalize">{user.plan || "Free"}</p>
            </Card>
          </div>
        </section>

        {/* Quick Tools */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Actions
            </h2>
            <Link
              href="/tools"
              className="text-sm hover:underline inline-flex items-center"
            >
              View all tools
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickTools.map((tool) => (
              <Link key={tool.name} href={tool.href}>
                <Card className="p-5 hover:bg-accent transition-colors cursor-pointer group">
                  <p className="font-medium group-hover:translate-x-0.5 transition-transform">
                    {tool.name}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
            Recent Activity
          </h2>

          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <Card key={activity.id} className="p-5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded bg-accent flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium">{activity.toolName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm px-2 py-1 rounded bg-accent">
                    {activity.status}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No recent activity</p>
              <Button asChild>
                <Link href="/tools">Browse tools</Link>
              </Button>
            </Card>
          )}
        </section>

        {/* Upgrade CTA */}
        {user.plan === "free" && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
            <Card className="p-8 bg-foreground text-background">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold mb-2">
                  Upgrade to Pro
                </h2>
                <p className="opacity-90 mb-6">
                  Get unlimited access to all tools and premium features
                </p>
                <Button variant="secondary" asChild>
                  <Link href="/pricing">
                    View plans
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}

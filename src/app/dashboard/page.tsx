import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Layers,
  LogIn,
  Presentation,
  Star,
  TrendingUp,
  UserCog,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getActivityTimeline, type ActivityKind } from "@/lib/platform/activity";
import { getStorageSummary, listFiles } from "@/lib/platform/files";
import { getFavorites, getUsageStatistics } from "@/lib/platform/usage";
import { listRecentDocuments } from "@/lib/officepilot/recent";
import { listRecentProjects } from "@/lib/socialpilot/recent";
import { FileText as GenericFileText } from "lucide-react";
import { platform } from "@/lib/products";
import { tools } from "@/lib/tools";
import { formatBytes } from "@/lib/format";

export const metadata: Metadata = {
  title: `Dashboard | ${platform.name}`,
  description: "Your storage, files, activity and usage across every LaunchStack product.",
};

export const dynamic = "force-dynamic";

/** Storage allowance per plan, in bytes. */
const PLAN_STORAGE: Record<string, number> = {
  free: 100 * 1024 * 1024,
  pro: 10 * 1024 * 1024 * 1024,
  business: 100 * 1024 * 1024 * 1024,
};

const ACTIVITY_ICON: Record<ActivityKind, typeof FileText> = {
  conversion: FileText,
  upload: Download,
  download: Download,
  login: LogIn,
  account: UserCog,
};

const OFFICE_KIND_ICON = {
  word: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
} as const;


function formatWhen(value: Date): string {
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  // Everything below is derived from this user's own rows; nothing is sampled.
  const [storage, recentFiles, activity, usage, favorites, recentOffice, recentSocial] = await Promise.all([
    getStorageSummary(user.id),
    listFiles(user.id, { limit: 5 }),
    getActivityTimeline(user.id, 8),
    getUsageStatistics(user.id),
    getFavorites(user.id),
    listRecentDocuments(user.id, { limit: 5 }),
    listRecentProjects(user.id, { limit: 5 }),
  ]);

  const allowance = PLAN_STORAGE[user.plan] ?? PLAN_STORAGE.free;
  const storagePercent = Math.min(100, Math.round((storage.usedBytes / allowance) * 100));

  // Fall back to a small starter set only when the user has no favourites yet;
  // these are links, not fabricated statistics.
  const suggestedTools = tools.slice(0, 4);

  return (
    <>
      <Navbar user={user} />

      <main className="animate-page-in">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user.name || "there"}</p>
        </section>

        {/* Usage statistics */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Operations</p>
              </div>
              <p className="text-2xl font-semibold">{usage.totalOperations}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {usage.operationsThisMonth} this month
              </p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Files</p>
              </div>
              <p className="text-2xl font-semibold">{storage.fileCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {storage.favoriteCount} favourited
              </p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="h-4 w-4 text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Storage</p>
              </div>
              <p className="text-2xl font-semibold">{formatBytes(storage.usedBytes)}</p>
              <div className="mt-2">
                <div
                  className="h-1.5 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={storagePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Storage used"
                >
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${storagePercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {storagePercent}% of {formatBytes(allowance)}
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Current plan</p>
              </div>
              <p className="text-2xl font-semibold capitalize">{user.plan}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {usage.successRate === null
                  ? "No operations yet"
                  : `${usage.successRate}% success rate`}
              </p>
            </Card>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            {/* Recent files */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent files
                </h2>
                <Link
                  href="/files"
                  className="text-sm hover:underline inline-flex items-center transition-colors rounded-md px-1 -mx-1"
                >
                  Open file manager
                  <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                </Link>
              </div>

              {recentFiles.length ? (
                <ul className="space-y-2">
                  {recentFiles.map((file) => (
                    <li key={file.id}>
                      <Card className="p-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{file.originalName}</p>
                          <p className="text-xs text-muted-foreground">
                            {file.productName} · {formatBytes(file.size)}
                          </p>
                        </div>
                        {file.isFavorite && (
                          <Star className="h-4 w-4 fill-primary text-primary shrink-0" aria-label="Favourite" />
                        )}
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : (
                <Card className="p-8 text-center">
                  <FileText className="mx-auto mb-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground mb-4">No files yet</p>
                  <Button asChild size="sm">
                    <Link href="/tools">Process your first file</Link>
                  </Button>
                </Card>
              )}
            </section>

            {/* Activity timeline */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Recent activity
              </h2>

              {activity.length ? (
                <Card className="divide-y divide-border/40">
                  {activity.map((entry) => {
                    const Icon = ACTIVITY_ICON[entry.kind];
                    return (
                      <div key={entry.id} className="flex items-center gap-3 p-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{entry.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.productName} · {formatWhen(entry.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            entry.status === "failed"
                              ? "bg-destructive/10 text-destructive"
                              : entry.status === "completed"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>
                    );
                  })}
                </Card>
              ) : (
                <Card className="p-8 text-center">
                  <Clock className="mx-auto mb-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    Conversions, uploads and account activity appear here
                  </p>
                </Card>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Recent OfficePilot documents */}
            {recentOffice.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Recent OfficePilot documents
                </h2>
                <div className="space-y-2">
                  {recentOffice.map((doc) => {
                    const Icon = OFFICE_KIND_ICON[doc.kind];
                    const href =
                      doc.kind === "word" ? "/officepilot" : `/officepilot/${doc.kind}`;
                    return (
                      <Link
                        key={doc.id}
                        href={href}
                        className="rounded-2xl focus-visible:outline-none"
                      >
                        <Card className="p-4 hover:bg-accent transition-colors cursor-pointer group flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{doc.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(doc.updatedAt).toLocaleDateString()} · v{doc.version}
                            </p>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Recent SocialPilot projects */}
            {recentSocial.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Recent SocialPilot projects
                </h2>
                <div className="space-y-2">
                  {recentSocial.map((entry) => {
                    const href =
                      entry.kind === "blank" ? "/socialpilot" : `/socialpilot/${entry.kind}`;
                    return (
                      <Link
                        key={entry.id}
                        href={href}
                        className="rounded-2xl focus-visible:outline-none"
                      >
                        <Card className="p-4 hover:bg-accent transition-colors cursor-pointer group flex items-center gap-2">
                          <GenericFileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{entry.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(entry.updatedAt).toLocaleDateString()} · v{entry.version}
                            </p>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Favourite tools */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                {favorites.tools.length ? "Favourite tools" : "Popular tools"}
              </h2>
              <div className="space-y-2">
                {(favorites.tools.length
                  ? favorites.tools.map((favorite) => ({
                      key: favorite.identifier,
                      name: favorite.name,
                      href: favorite.href,
                    }))
                  : suggestedTools.map((tool) => ({
                      key: tool.id,
                      name: tool.name,
                      href: tool.href,
                    }))
                ).map((entry) => (
                  <Link
                    key={entry.key}
                    href={entry.href}
                    className="rounded-2xl focus-visible:outline-none"
                  >
                    <Card className="p-4 hover:bg-accent transition-colors cursor-pointer group flex items-center gap-2">
                      {favorites.tools.length > 0 && (
                        <Star className="h-3.5 w-3.5 fill-primary text-primary shrink-0" aria-hidden="true" />
                      )}
                      <p className="text-sm font-medium group-hover:translate-x-0.5 transition-transform">
                        {entry.name}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
              {!favorites.tools.length && (
                <p className="text-xs text-muted-foreground mt-3">
                  Star a tool to pin it here
                </p>
              )}
            </section>

            {/* Favourite products */}
            {favorites.products.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Favourite products
                </h2>
                <div className="space-y-2">
                  {favorites.products.map((product) => (
                    <Link
                      key={product.identifier}
                      href={product.href}
                      className="rounded-2xl focus-visible:outline-none"
                    >
                      <Card className="p-4 hover:bg-accent transition-colors cursor-pointer flex items-center gap-2">
                        <Star className="h-3.5 w-3.5 fill-primary text-primary shrink-0" aria-hidden="true" />
                        <p className="text-sm font-medium">{product.name}</p>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Most used */}
            {usage.topTools.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Most used
                </h2>
                <Card className="p-4 space-y-3">
                  {usage.topTools.map((entry) => (
                    <div key={entry.toolName} className="flex items-center justify-between gap-3">
                      {entry.href ? (
                        <Link
                          href={entry.href}
                          className="text-sm truncate hover:underline transition-colors rounded-md px-1 -mx-1"
                        >
                          {entry.toolName}
                        </Link>
                      ) : (
                        <span className="text-sm truncate">{entry.toolName}</span>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {entry.count}×
                      </span>
                    </div>
                  ))}
                </Card>
              </section>
            )}

            {/* Storage by product */}
            {storage.byProduct.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Storage by product
                </h2>
                <Card className="p-4 space-y-3">
                  {storage.byProduct.map((entry) => (
                    <div key={entry.productId} className="flex items-center justify-between gap-3">
                      <span className="text-sm truncate">{entry.productName}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatBytes(entry.bytes)}
                      </span>
                    </div>
                  ))}
                </Card>
              </section>
            )}

            {user.plan === "free" && (
              <Card className="p-6 bg-foreground text-background">
                <h2 className="text-lg font-bold mb-2">Upgrade to Pro</h2>
                <p className="text-sm opacity-90 mb-5">
                  More storage and higher limits across every product
                </p>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/pricing">
                    View plans
                    <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

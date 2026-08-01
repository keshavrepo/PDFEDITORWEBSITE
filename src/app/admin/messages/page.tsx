import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { contactSubmissions } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageStatus } from "@/components/message-status";

interface MessagesPageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}
const PAGE_SIZE = 15;

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() || "";
  const allowedStatuses = ["new", "in_progress", "resolved"];
  const status = allowedStatuses.includes(params.status || "") ? params.status! : "";
  const page = Math.max(1, Number(params.page) || 1);
  const where = and(
    search
      ? or(
          ilike(contactSubmissions.email, `%${search}%`),
          ilike(contactSubmissions.firstName, `%${search}%`),
          ilike(contactSubmissions.lastName, `%${search}%`),
          ilike(contactSubmissions.subject, `%${search}%`)
        )
      : undefined,
    status ? eq(contactSubmissions.status, status) : undefined
  );
  const [messages, totalRows] = await Promise.all([
    db.select().from(contactSubmissions).where(where).orderBy(desc(contactSubmissions.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(contactSubmissions).where(where),
  ]);
  const totalPages = Math.max(1, Math.ceil((totalRows[0]?.value || 0) / PAGE_SIZE));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8"><h1 className="text-3xl font-bold">Contact messages</h1><p className="text-muted-foreground mt-1">Review and track enquiries submitted through the contact page.</p></div>
      <Card className="p-4 mb-6"><form className="flex flex-col sm:flex-row gap-3"><Input name="q" defaultValue={search} placeholder="Search name, email, or subject" /><select name="status" defaultValue={status} className="h-10 rounded-lg border border-input bg-background px-3 text-sm sm:w-44"><option value="">All statuses</option><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><Button variant="outline">Filter</Button></form></Card>
      <div className="space-y-4">
        {messages.map((message) => (
          <Card key={message.id} className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-semibold">{message.subject || "General enquiry"}</h2>
                <p className="text-sm text-muted-foreground mt-1">{message.firstName} {message.lastName} · <a className="underline" href={`mailto:${message.email}`}>{message.email}</a> · {message.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</p>
              </div>
              <MessageStatus id={message.id} initialStatus={message.status} />
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{message.message}</p>
          </Card>
        ))}
        {!messages.length && <Card className="p-12 text-center text-muted-foreground">No messages found.</Card>}
      </div>
      {totalPages > 1 && <div className="mt-8 text-center text-sm text-muted-foreground">Page {page} of {totalPages}</div>}
    </main>
  );
}

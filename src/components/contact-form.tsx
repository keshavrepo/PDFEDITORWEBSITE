"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const textareaClass =
  "flex min-h-[140px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function ContactForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          email: data.get("email"),
          subject: data.get("subject"),
          message: data.get("message"),
          website: data.get("website"),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to send message");
      form.reset();
      setCompleted(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to send message"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <div className="py-10 text-center" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary mb-4" />
        <h2 className="text-xl font-semibold mb-2">Message received</h2>
        <p className="text-sm text-muted-foreground mb-6">
          The Keshav Labs team will respond during business hours.
        </p>
        <Button variant="outline" onClick={() => setCompleted(false)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="firstName" className="text-sm font-medium">First name</label>
          <Input id="firstName" name="firstName" autoComplete="given-name" maxLength={100} required disabled={submitting} />
        </div>
        <div className="space-y-2">
          <label htmlFor="lastName" className="text-sm font-medium">Last name</label>
          <Input id="lastName" name="lastName" autoComplete="family-name" maxLength={100} required disabled={submitting} />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="contactEmail" className="text-sm font-medium">Email</label>
        <Input id="contactEmail" name="email" type="email" autoComplete="email" defaultValue={defaultEmail} maxLength={255} required disabled={submitting} />
      </div>
      <div className="space-y-2">
        <label htmlFor="subject" className="text-sm font-medium">Subject</label>
        <Input id="subject" name="subject" maxLength={200} placeholder="How can we help?" disabled={submitting} />
      </div>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="space-y-2">
        <label htmlFor="message" className="text-sm font-medium">Message</label>
        <textarea id="message" name="message" className={textareaClass} minLength={20} maxLength={10000} placeholder="Tell us what you need help with" required disabled={submitting} />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitting ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}

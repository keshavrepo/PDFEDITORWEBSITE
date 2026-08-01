import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contactSubmissions } from "@/db/schema";
import { escapeHtml, sendEmail } from "@/lib/email";
import { isEmailConfigured } from "@/lib/env";
import {
  checkRateLimit,
  getClientIp,
  isSameOrigin,
  rateLimitResponse,
} from "@/lib/request";
import { siteConfig } from "@/lib/site";

const contactSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(20, "Please provide at least 20 characters").max(10_000),
  website: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const ipAddress = getClientIp(request);
  const rateLimit = checkRateLimit(`contact:${ipAddress}`, 5, 60 * 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  try {
    const parsed = contactSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Check your message details" },
        { status: 400 }
      );
    }

    const [submission] = await db
      .insert(contactSubmissions)
      .values({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        subject: parsed.data.subject || null,
        message: parsed.data.message,
        ipAddress,
        userAgent: request.headers.get("user-agent"),
      })
      .returning({ id: contactSubmissions.id });

    if (isEmailConfigured()) {
      try {
        const sent = await sendEmail({
          to: siteConfig.supportEmail,
          replyTo: parsed.data.email,
          subject: `PDFPilot contact: ${parsed.data.subject || "New enquiry"}`,
          html: `<p><strong>From:</strong> ${escapeHtml(`${parsed.data.firstName} ${parsed.data.lastName}`)} (${escapeHtml(parsed.data.email)})</p><p><strong>Subject:</strong> ${escapeHtml(parsed.data.subject || "General enquiry")}</p><p>${escapeHtml(parsed.data.message).replace(/\n/g, "<br>")}</p>`,
        });
        if (sent) {
          await db
            .update(contactSubmissions)
            .set({ notificationSentAt: new Date() })
            .where(eq(contactSubmissions.id, submission.id));
        }
      } catch (emailError) {
        console.error("Contact notification delivery failed", emailError);
      }
    }

    return Response.json(
      { message: "Thanks for contacting PDFPilot. Your message has been received." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact submission failed", error);
    return Response.json({ error: "Unable to send your message right now" }, { status: 500 });
  }
}

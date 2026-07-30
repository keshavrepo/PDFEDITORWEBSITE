import { z } from "zod";

const optionalText = (maximum: number) =>
  z.union([z.string().trim().max(maximum), z.literal("")]).optional();

export const blogPostInputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().min(1).max(220).optional(),
  excerpt: z.string().trim().min(20).max(600),
  content: z.string().min(20).max(250_000),
  featuredImage: z
    .union([z.string().trim().url().max(2048), z.literal(""), z.null()])
    .optional(),
  category: optionalText(100),
  tags: z.union([z.array(z.string().max(60)).max(12), z.string().max(720)]).optional(),
  status: z.enum(["draft", "published"]),
  seoTitle: optionalText(200),
  seoDescription: optionalText(320),
  seoKeywords: optionalText(500),
});

export type BlogPostInput = z.infer<typeof blogPostInputSchema>;

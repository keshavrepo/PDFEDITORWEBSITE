/**
 * Global search index.
 *
 * Products, tools and documentation are static, so their index is built once
 * at module load and matched in memory — that keeps search instant without a
 * network round trip. Blog articles live in the database and are merged in by
 * the search endpoint.
 */

import { products } from "@/lib/products";
import { tools } from "@/lib/tools";
import { imageTools } from "@/lib/imagepilot/tools";
import { documentationSections } from "@/lib/platform/documentation";

export type SearchResultType = "product" | "tool" | "article" | "documentation";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  href: string;
  /** Group label shown beside the result, e.g. "PDFPilot" or "Convert". */
  context?: string;
  /** Higher scores sort first. */
  score: number;
}

interface IndexEntry {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  href: string;
  context?: string;
  /** Lowercased haystack searched against. */
  haystack: string;
  /** Bias applied so live products outrank future ones. */
  weight: number;
}

function buildStaticIndex(): IndexEntry[] {
  const entries: IndexEntry[] = [];

  for (const product of products) {
    const available = product.status === "active";
    entries.push({
      id: `product-${product.id}`,
      type: "product",
      title: product.name,
      description: product.tagline,
      // Products without their own page link to the products directory.
      href: product.href ?? "/products",
      context: available ? "Product" : "Coming soon",
      haystack: [
        product.name,
        product.tagline,
        product.description,
        product.category,
        ...product.highlights,
      ]
        .join(" ")
        .toLowerCase(),
      weight: available ? 3 : 1,
    });
  }

  for (const tool of tools) {
    entries.push({
      id: `tool-${tool.id}`,
      type: "tool",
      title: tool.name,
      description: tool.description,
      href: tool.href,
      context: `PDFPilot · ${tool.category}`,
      haystack: `${tool.name} ${tool.description} ${tool.category}`.toLowerCase(),
      weight: 2,
    });
  }

  for (const tool of imageTools) {
    entries.push({
      id: `tool-${tool.id}`,
      type: "tool",
      title: tool.name,
      description: tool.description,
      href: tool.href,
      context: `ImagePilot · ${tool.category}`,
      haystack: `${tool.name} ${tool.description} ${tool.category} ${tool.keywords.join(" ")}`.toLowerCase(),
      weight: 2,
    });
  }

  for (const section of documentationSections) {
    entries.push({
      id: `doc-${section.id}`,
      type: "documentation",
      title: section.title,
      description: section.summary,
      href: `/docs#${section.id}`,
      context: "Documentation",
      haystack: `${section.title} ${section.summary} ${section.keywords.join(" ")}`.toLowerCase(),
      weight: 1.5,
    });
  }

  return entries;
}

const staticIndex = buildStaticIndex();

/**
 * Scores one entry against a query.
 *
 * Every term must appear somewhere, which keeps multi-word queries precise.
 * A title match outranks a body match so the obvious result surfaces first.
 */
function scoreEntry(entry: IndexEntry, terms: string[]): number {
  const title = entry.title.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (!entry.haystack.includes(term)) return 0;

    if (title === term) score += 10;
    else if (title.startsWith(term)) score += 6;
    else if (title.includes(term)) score += 4;
    else score += 1;
  }

  return score * entry.weight;
}

/** Searches products, tools and documentation. */
export function searchStatic(query: string, limit = 20): SearchResult[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  const results: SearchResult[] = [];
  for (const entry of staticIndex) {
    const score = scoreEntry(entry, terms);
    if (score <= 0) continue;
    results.push({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      description: entry.description,
      href: entry.href,
      context: entry.context,
      score,
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Ordering used when grouping results in the UI. */
export const searchTypeOrder: SearchResultType[] = [
  "tool",
  "product",
  "article",
  "documentation",
];

export const searchTypeLabels: Record<SearchResultType, string> = {
  tool: "Tools",
  product: "Products",
  article: "Articles",
  documentation: "Documentation",
};

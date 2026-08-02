import type { MetadataRoute } from "next";
import { products } from "@/lib/products";
import { appUrl } from "@/lib/seo";

/**
 * Dynamic sitemap.
 *
 * The static marketing / legal / support surface is enumerated
 * explicitly below so the sitemap is stable. Product landing pages
 * are pulled from the product registry so a new product flips on
 * the registry flag and shows up here with no code change.
 *
 * The PDFPilot /tools index lists every PDF tool — those tools are
 * intentionally not in the sitemap individually because they are
 * surface-deep. The /tools index page itself is included.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    // Marketing
    { path: "/", changeFrequency: "weekly", priority: 1.0 },
    { path: "/products", changeFrequency: "weekly", priority: 0.9 },
    { path: "/features", changeFrequency: "monthly", priority: 0.7 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
    { path: "/tools", changeFrequency: "weekly", priority: 0.9 },
    { path: "/api-docs", changeFrequency: "monthly", priority: 0.5 },
    // Company
    { path: "/about", changeFrequency: "monthly", priority: 0.6 },
    { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
    { path: "/careers", changeFrequency: "monthly", priority: 0.5 },
    { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
    // Support
    { path: "/docs", changeFrequency: "monthly", priority: 0.6 },
    { path: "/help", changeFrequency: "monthly", priority: 0.6 },
    { path: "/community", changeFrequency: "monthly", priority: 0.5 },
    { path: "/status", changeFrequency: "daily", priority: 0.4 },
    // Legal
    { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
    { path: "/security", changeFrequency: "yearly", priority: 0.4 },
    { path: "/cookies", changeFrequency: "yearly", priority: 0.3 },
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: appUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Live product landing pages
  for (const product of products) {
    if (product.status !== "active" || !product.href) continue;
    entries.push({
      url: appUrl(`/products/${product.id}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
    // The live product surface itself is also indexable.
    if (
      product.id === "pdfpilot" ||
      product.id === "imagepilot" ||
      product.id === "audiopilot" ||
      product.id === "officepilot" ||
      product.id === "devpilot" ||
      product.id === "socialpilot" ||
      product.id === "financepilot" ||
      product.id === "webpilot"
    ) {
      entries.push({
        url: appUrl(product.href),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  return entries;
}

import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/seo";

/**
 * Robots policy.
 *
 * Every public route on the platform is indexable. The only things we
 * block are the private account surface (`/dashboard`, `/files`,
 * `/settings`), the auth surface (`/login`, `/register`,
 * `/forgot-password`, `/reset-password`), the admin console
 * (`/admin`), and the entire API surface (`/api/*`). Tooling routes
 * such as `/tools/<tool>` are indexable so the marketing pages can
 * appear in search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard",
          "/files",
          "/settings",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${appOrigin()}/sitemap.xml`,
    host: appOrigin(),
  };
}

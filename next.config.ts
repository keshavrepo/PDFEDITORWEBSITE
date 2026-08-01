import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  /**
   * Rewrite barrel imports into deep imports at build time.
   *
   * `lucide-react` exports over four thousand icons from one entry point and
   * is imported by 49 components; without this the bundler has to walk the
   * whole barrel on every one of them. The same applies to the Radix
   * primitives, which re-export a tree of sub-modules.
   *
   * This is a build-time transform only — the source keeps its readable
   * named imports and no component changes.
   */
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-avatar",
      "@radix-ui/react-dropdown-menu",
      "date-fns",
    ],
  },
  /**
   * Keep native and WASM-backed modules out of the client graph.
   *
   * `sharp` is a native binary used only by server routes, and `qpdf-run`
   * loads its own WASM from `public/qpdf` at runtime. Listing them here stops
   * the bundler from attempting to trace either into a browser chunk.
   */
  serverExternalPackages: ["sharp"],
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 82, 90],
    minimumCacheTTL: 86_400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/blog/**",
      },
    ],
  },
  /**
   * Convenience aliases for the platform layout. Every existing PDFPilot URL
   * (/tools and each /tools/* route) is unchanged and still served directly;
   * these only add new entry points, so no bookmark or search result breaks.
   */
  async redirects() {
    return [
      { source: "/pdfpilot", destination: "/products/pdfpilot", permanent: false },
      { source: "/pdfpilot/tools", destination: "/tools", permanent: false },
      { source: "/product/pdfpilot", destination: "/products/pdfpilot", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

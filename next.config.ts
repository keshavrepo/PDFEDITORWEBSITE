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

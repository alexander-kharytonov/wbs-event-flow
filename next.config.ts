import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.2.142"],
  // Uploaded media must never enter the optimizer's independently public cache.
  images: {
    localPatterns: [{ pathname: "/_next/static/media/**", search: "" }],
  },
  // Do not log auth or private access requests; bearer exchanges use POST bodies.
  logging: {
    serverFunctions: false,
    incomingRequests: {
      ignore: [/\/api\/auth\//, /\/(?:ticket|application)(?:\/|%2f)/i],
    },
  },
  async headers() {
    return [
      {
        source: "/print/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/application/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/ticket/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

export default withNextIntl(nextConfig);

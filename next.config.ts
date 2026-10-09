import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.2.142"],
  // Uploaded media must never enter the optimizer's independently public cache.
  images: {
    localPatterns: [{ pathname: "/_next/static/media/**", search: "" }],
  },
  // Auth and anonymous Ticket URLs contain bearer secrets.
  logging: {
    serverFunctions: false,
    incomingRequests: { ignore: [/\/api\/auth\//, /\/ticket(?:\/|%2f)/i] },
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

export default nextConfig;

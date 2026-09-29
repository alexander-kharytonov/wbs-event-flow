import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth and anonymous Ticket URLs contain bearer secrets.
  logging: {
    incomingRequests: { ignore: [/\/api\/auth\//, /\/ticket(?:\/|%2f)/i] },
  },
  async headers() {
    return [
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

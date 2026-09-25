import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Verification requests contain a token in the URL.
  logging: { incomingRequests: { ignore: [/\/api\/auth\//] } },
};

export default nextConfig;

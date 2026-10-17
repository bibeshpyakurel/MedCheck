import type { NextConfig } from "next";

// cacheComponents is intentionally off: nearly every page reads the user's session, and
// parallel feature work is simpler with plain dynamic rendering. Revisit after the hackathon.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  // Label photos are posted to a Server Action. The client downscales to <=2000px JPEG (well under
  // 4 MB); the default 1 MB limit is too small for a sharp photo of small print.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;

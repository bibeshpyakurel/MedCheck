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
};

export default nextConfig;

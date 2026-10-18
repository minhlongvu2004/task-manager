import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // PGlite loads its wasm/data files from disk; bundling it breaks that.
  serverExternalPackages: ["@electric-sql/pglite"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the web build isolated from Deno Edge Functions and Cloudflare worker code.
  typescript: {
    tsconfigPath: "tsconfig.app.json",
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import {withWorkflow} from "workflow/next";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["tesseract.js","tesseract.js-core","@tesseract.js-data/eng","@napi-rs/canvas"],
  outputFileTracingIncludes: {"/api/{process-document,import-document}": ["./node_modules/tesseract.js/**/*","./node_modules/tesseract.js-core/**/*","./node_modules/@tesseract.js-data/eng/**/*","./node_modules/@napi-rs/canvas*/**/*"]},
  // Keep the web build isolated from Deno Edge Functions and Cloudflare worker code.
  typescript: {
    tsconfigPath: "tsconfig.app.json",
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default withWorkflow(nextConfig);

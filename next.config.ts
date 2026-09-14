import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Baked in at `next build` time (not per-request/per-isolate), so it
  // reflects when this deploy was actually built rather than a Worker
  // isolate's most recent cold start — see AppFooter, the only reader.
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  experimental: {
    serverActions: {
      // Server Actions reject a request whose Origin header doesn't match
      // the Host (or X-Forwarded-Host) header the Worker sees — a CSRF
      // guard that needs this allowlist specifically for an app served
      // through a CDN/proxy in front of it (Cloudflare in front of the
      // Worker, custom domain).
      allowedOrigins: ["scheduler.oradellfire.org"],
    },
  },
};

export default nextConfig;

// Enables the Next.js dev server (`next dev`) to read Cloudflare bindings
// (D1, etc.) from wrangler.jsonc during local development.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();

// Custom Worker entrypoint, used in place of the OpenNext-generated
// `.open-next/worker.js` directly (see wrangler.jsonc's `main`). The
// generated worker only exports a `fetch` handler — there's no hook for
// Cloudflare Cron Triggers to call into — so this wraps it and adds a
// `scheduled` handler for the Monday check reminder and the daily period
// auto-generation. Passing `fetch` straight through keeps every other
// request behaving exactly as it did before this file existed.
//
// The `scheduled` handler doesn't touch the D1/Mailgun logic directly —
// it self-fetches the app's own /api/cron/* routes through the
// WORKER_SELF_REFERENCE service binding (already present for OpenNext's
// caching, see wrangler.jsonc), the same way a real request would arrive.
// That request passes back through the generated worker's `fetch`, which
// sets up the Cloudflare request context (D1 binding, etc.) the normal
// way — reimplementing that setup here would be fragile and is exactly
// what this sidesteps.
//
// Both routes are hit on the same single hourly Cron Trigger rather than
// each getting its own — /api/cron/remind gates itself to the configured
// reminder day/hour, and /api/cron/auto-generate-periods gates itself to
// once a day, so firing both hourly just means most calls no-op quickly.
//
// This file is intentionally excluded from the Next.js/TypeScript project
// (see tsconfig.json `exclude`) — it's bundled by wrangler/esbuild instead,
// and its import of `./.open-next/worker.js` only resolves after
// `opennextjs-cloudflare build` has generated that file, which happens
// before wrangler ever bundles `main`.
// @ts-expect-error: only exists after `opennextjs-cloudflare build` runs
import openNextHandler from "./.open-next/worker.js";

interface Env extends CloudflareEnv {
  // Set with `wrangler secret put CRON_SECRET` — never committed to
  // wrangler.jsonc's plain `vars`. Checked by each route handler itself;
  // this file just forwards it.
  CRON_SECRET?: string;
}

const CRON_ROUTES = ["/api/cron/remind", "/api/cron/auto-generate-periods"];

export default {
  fetch: openNextHandler.fetch,

  async scheduled(_controller, env: Env, _ctx) {
    if (!env.WORKER_SELF_REFERENCE) {
      console.error("Cron: WORKER_SELF_REFERENCE binding is missing");
      return;
    }
    if (!env.CRON_SECRET) {
      console.error("Cron: CRON_SECRET is not configured");
      return;
    }

    for (const path of CRON_ROUTES) {
      const response = await env.WORKER_SELF_REFERENCE.fetch(`https://internal.invalid${path}`, {
        method: "POST",
        headers: { "x-cron-secret": env.CRON_SECRET },
      });
      if (!response.ok) {
        console.error(`Cron ${path} failed: ${response.status} ${await response.text()}`);
      }
    }
  },
} satisfies ExportedHandler<Env>;

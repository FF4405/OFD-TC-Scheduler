import { defineConfig } from "drizzle-kit";

// Migrations are generated here as plain SQL files and applied against D1
// with `wrangler d1 migrations apply` — not via `drizzle-kit push`/`migrate`,
// so no live D1 driver credentials are needed in this config.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
});

import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";

import { AppFooter } from "@/components/nav/app-footer";
import { AppNav } from "@/components/nav/app-nav";
import { PendingAccessBanner } from "@/components/nav/pending-access-banner";
import { getDb } from "@/db/client";
import { accessRequests } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

// This is the actual authorization boundary — Cloudflare Workers via
// OpenNext can't run Next.js 16's Proxy (it's Node.js-runtime-only there,
// which OpenNext's Cloudflare adapter doesn't support), so auth is enforced
// here at the layout level instead of in middleware. getCurrentUser() only
// returns null when there's no valid session cookie — anyone with one gets
// a row and renders the app shell below, active member or not, since a
// not-yet-approved or deactivated account still needs to see the read-only
// schedule and the request-access page rather than being treated as
// logged out; see permissions.ts for what's actually gated on isActive.
//
// force-dynamic is load-bearing, not a perf knob: getCurrentUser() reads
// the per-request session cookie, so without this Next would statically
// prerender whichever identity resolves at build time (none) and serve
// that same cached response to every visitor instead of checking each
// request.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // An inactive account that hasn't yet asked for access at all — a
  // brand-new signup, or a member an admin deactivated who's now signed
  // back in — goes through the welcome splash before anything else,
  // including the read-only schedule. Once they've asked (a pending
  // request exists), stop redirecting them here so they can freely browse
  // while it's reviewed. /welcome lives outside this route group, so this
  // can't loop.
  if (!user.isActive) {
    const db = getDb();
    const [pending] = await db
      .select({ id: accessRequests.id })
      .from(accessRequests)
      .where(and(eq(accessRequests.userId, user.id), eq(accessRequests.status, "pending")))
      .limit(1);
    if (!pending) redirect("/welcome");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav user={user} />
      {!user.isActive ? <PendingAccessBanner /> : null}
      <main className="flex flex-1 flex-col">{children}</main>
      <AppFooter />
    </div>
  );
}

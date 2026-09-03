import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";

import { getDb } from "@/db/client";
import { sessions, users } from "@/db/schema";

import { sha256Hex } from "./crypto";

export type CurrentUser = typeof users.$inferSelect;

const SESSION_COOKIE_NAME = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, fixed — no sliding renewal

const ADMIN_BOOTSTRAP_EMAILS = (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Called once, right after a verified OTP — not on every request, since a
// session cookie already carries the resolved userId from then on.
export async function findOrCreateUser(email: string): Promise<CurrentUser> {
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    // A seeded roster row already had this person's real email — claim
    // the placeholder on their first real sign-in instead of leaving it
    // stuck as a placeholder forever. They keep whatever isActive/roster
    // fields the seed already gave them (the seeded roster is trusted).
    if (existing.isPlaceholder) {
      const [claimed] = await db
        .update(users)
        .set({ isPlaceholder: false, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning();
      return claimed;
    }
    return existing;
  }

  // Signing in restricts *who can reach this point at all* (see the
  // ALLOWED_EMAIL_DOMAINS check in lib/auth/otp.ts), but someone with no
  // existing roster row is genuinely new — they provision inactive
  // (isActive: false), read-only until an admin approves them and fills in
  // their roster fields (see admin/users). An ADMIN_BOOTSTRAP_EMAILS match
  // is the one exception, since bootstrapping the first admin can't itself
  // wait on an admin to approve it.
  const isBootstrapAdmin = ADMIN_BOOTSTRAP_EMAILS.includes(email);
  try {
    const [created] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email,
        name: email,
        isAdmin: isBootstrapAdmin,
        isActive: isBootstrapAdmin,
        rosterActive: false,
      })
      .returning();
    return created;
  } catch {
    // Two genuinely concurrent first-ever sign-ins can both reach here
    // before either commits. The loser hits the email unique constraint;
    // re-read what the winner just inserted instead of throwing.
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!row) throw new Error("Failed to find or create user");
    return row;
  }
}

// Issues a new 30-day session for userId and sets its cookie. Only
// callable from a Server Function/Route Handler — Next.js rejects
// cookies().set() from a Server Component.
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const id = await sha256Hex(token); // only the hash is ever persisted
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const db = getDb();
  await db.insert(sessions).values({ id, userId, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// Deletes the current session, both the D1 row and the browser cookie.
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const id = await sha256Hex(token);
    await getDb().delete(sessions).where(eq(sessions.id, id));
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// Re-reads the session (and the user it belongs to) from D1 on every
// request rather than trusting a long-lived cache, so a demoted/
// deactivated user — or one whose session was explicitly revoked — can't
// keep acting on stale state past their current page load. Wrapped in
// React's cache() so the layout and the page (both call this) share one DB
// round trip per request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const id = await sha256Hex(token);
  const db = getDb();
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return row?.user ?? null;
});

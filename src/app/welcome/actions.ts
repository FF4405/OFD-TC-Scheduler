"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { accessRequests, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getAppOrigin } from "@/lib/get-app-origin";
import { accessRequestSubmittedEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sender";

export type WelcomeState = {
  error?: string;
};

export type WelcomeInput = {
  fullName: string;
  lineNumber: string;
};

// The welcome splash's one action — collects whatever's still missing
// (name, line #) and files an access request. Reached by both first-ever
// signups and deactivated members signing back in (see app/welcome/page.tsx),
// so name/line# are only asked for if not already on file.
export async function completeOnboarding(
  _prevState: WelcomeState,
  input: WelcomeInput,
): Promise<WelcomeState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (user.isActive) redirect("/");

  const db = getDb();

  const [existingPending] = await db
    .select({ id: accessRequests.id })
    .from(accessRequests)
    .where(and(eq(accessRequests.userId, user.id), eq(accessRequests.status, "pending")))
    .limit(1);
  if (existingPending) redirect("/");

  const hasName = user.name !== user.email;
  const hasLineNumber = Boolean(user.lineNumber);

  let name = user.name;
  if (!hasName) {
    const trimmed = input.fullName.trim();
    if (!trimmed) return { error: "Enter your full name." };
    name = trimmed;
  }

  let lineNumber = user.lineNumber;
  if (!hasLineNumber) {
    const trimmed = input.lineNumber.trim();
    lineNumber = trimmed || null;
  }

  await db.update(users).set({ name, lineNumber, updatedAt: new Date() }).where(eq(users.id, user.id));

  await db.insert(accessRequests).values({
    id: crypto.randomUUID(),
    userId: user.id,
  });

  await notifyAdmins(name, user.email);

  redirect("/");
}

async function notifyAdmins(name: string, email: string) {
  try {
    const db = getDb();
    const admins = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.isAdmin, true), eq(users.isActive, true)));
    if (admins.length === 0) return;

    const origin = await getAppOrigin();
    const { subject, html } = accessRequestSubmittedEmail({
      requesterName: name,
      requesterEmail: email,
      reviewUrl: `${origin}/admin/access-requests`,
    });
    await sendEmail({ to: admins.map((a) => a.email), subject, html });
  } catch (error) {
    // The request is already recorded and visible in the admin queue
    // regardless — email is a nudge, not the source of truth.
    console.error("Failed to send onboarding notification email", error);
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { accessRequests, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getAppOrigin } from "@/lib/get-app-origin";
import { accessRequestSubmittedEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sender";

export type RequestAccessState = {
  error?: string;
  success?: boolean;
};

// Only reachable for someone already inactive without a pending request
// (the (app)/layout.tsx redirect to /welcome catches anyone else) — mainly
// used to re-request after a denial.
export async function submitAccessRequest(): Promise<RequestAccessState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (user.isActive) return { error: "You're already a member." };

  const db = getDb();
  const [existingPending] = await db
    .select({ id: accessRequests.id })
    .from(accessRequests)
    .where(and(eq(accessRequests.userId, user.id), eq(accessRequests.status, "pending")))
    .limit(1);
  if (existingPending) return { error: "You already have a pending request." };

  await db.insert(accessRequests).values({ id: crypto.randomUUID(), userId: user.id });

  try {
    const admins = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.isAdmin, true), eq(users.isActive, true)));
    if (admins.length > 0) {
      const origin = await getAppOrigin();
      const { subject, html } = accessRequestSubmittedEmail({
        requesterName: user.name,
        requesterEmail: user.email,
        reviewUrl: `${origin}/admin/access-requests`,
      });
      await sendEmail({ to: admins.map((a) => a.email), subject, html });
    }
  } catch (error) {
    console.error("Failed to send access-request notification email", error);
  }

  revalidatePath("/request-access");
  revalidatePath("/admin/access-requests");
  return { success: true };
}

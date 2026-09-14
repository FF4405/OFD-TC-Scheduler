"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { accessRequests, users } from "@/db/schema";
import { canReviewAccessRequests } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getAppOrigin } from "@/lib/get-app-origin";
import { accessRequestDecisionEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sender";

async function loadPendingRequestWithRequester(requestId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(accessRequests)
    .innerJoin(users, eq(users.id, accessRequests.userId))
    .where(eq(accessRequests.id, requestId))
    .limit(1);
  if (!row || row.access_requests.status !== "pending") return null;
  return { request: row.access_requests, requester: row.users };
}

async function requireReviewer() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  if (!canReviewAccessRequests(user)) {
    throw new Error("You're not authorized to review this request.");
  }
  return user;
}

export async function approveAccessRequest(requestId: string): Promise<void> {
  const loaded = await loadPendingRequestWithRequester(requestId);
  if (!loaded) return;
  const { request, requester } = loaded;
  const reviewer = await requireReviewer();

  const db = getDb();
  // Approving grants sign-in access and puts them in the rotation queue
  // (at the back, if they aren't already placed).
  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${users.rotationPosition}), 0)` })
    .from(users);
  await db
    .update(users)
    .set({
      isActive: true,
      rosterActive: true,
      rotationPosition: requester.rotationPosition ?? maxPos + 1,
      updatedAt: new Date(),
    })
    .where(eq(users.id, request.userId));

  await db
    .update(accessRequests)
    .set({ status: "approved", reviewedBy: reviewer.id, reviewedAt: new Date() })
    .where(eq(accessRequests.id, requestId));

  await notifyRequester(requester, "approved");

  revalidatePath("/admin/access-requests");
  revalidatePath("/admin/users");
  revalidatePath("/members");
  revalidatePath("/request-access");
}

export async function denyAccessRequest(requestId: string, note: string): Promise<void> {
  const loaded = await loadPendingRequestWithRequester(requestId);
  if (!loaded) return;
  const { requester } = loaded;
  const reviewer = await requireReviewer();
  const trimmedNote = note.trim();

  const db = getDb();
  await db
    .update(accessRequests)
    .set({
      status: "denied",
      reviewedBy: reviewer.id,
      reviewedAt: new Date(),
      reviewNote: trimmedNote || null,
    })
    .where(eq(accessRequests.id, requestId));

  await notifyRequester(requester, "denied", trimmedNote);

  revalidatePath("/admin/access-requests");
  revalidatePath("/request-access");
}

async function notifyRequester(
  requester: { email: string },
  status: "approved" | "denied",
  reviewNote?: string,
) {
  try {
    const origin = await getAppOrigin();
    const { subject, html } = accessRequestDecisionEmail({ status, reviewNote, appUrl: origin });
    await sendEmail({ to: [requester.email], subject, html });
  } catch (error) {
    console.error("Failed to send access-request decision email", error);
  }
}

import { desc, eq } from "drizzle-orm";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { accessRequests } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

import { RequestAccessForm } from "./request-access-form";

export const dynamic = "force-dynamic";

export default async function RequestAccessPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const db = getDb();
  const myRequests = await db
    .select()
    .from(accessRequests)
    .where(eq(accessRequests.userId, user.id))
    .orderBy(desc(accessRequests.createdAt));

  const hasPending = myRequests.some((r) => r.status === "pending");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-4 sm:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Request access</CardTitle>
          <CardDescription>
            {user.isActive
              ? "You're already an active member."
              : "An admin reviews every request to join OFD TC Scheduler."}
          </CardDescription>
        </CardHeader>
        {!user.isActive && !hasPending ? (
          <CardContent>
            <RequestAccessForm />
          </CardContent>
        ) : null}
      </Card>

      {myRequests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y">
              {myRequests.map((request) => (
                <div key={request.id} className="flex flex-col gap-0.5 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Member access</span>
                    <span className="text-muted-foreground capitalize">{request.status}</span>
                  </div>
                  {request.reviewNote ? (
                    <span className="text-muted-foreground text-xs">Note: {request.reviewNote}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

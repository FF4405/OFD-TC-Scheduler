import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { accessRequests, users } from "@/db/schema";
import { isAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

import { AccessRequestRow } from "./access-request-row";

export const dynamic = "force-dynamic";

export default async function AdminAccessRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  const db = getDb();
  const rows = await db
    .select({ request: accessRequests, requester: users })
    .from(accessRequests)
    .innerJoin(users, eq(users.id, accessRequests.userId))
    .orderBy(desc(accessRequests.createdAt))
    .limit(100);

  const pending = rows.filter((r) => r.request.status === "pending");
  const reviewed = rows.filter((r) => r.request.status !== "pending");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Access requests</CardTitle>
          <CardDescription>People asking to join OFD TC Scheduler.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending requests.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {pending.map(({ request, requester }) => (
                <div key={request.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{requester.name}</span>
                    <span className="text-muted-foreground text-xs">{requester.email}</span>
                  </div>
                  <AccessRequestRow requestId={request.id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {reviewed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y">
              {reviewed.map(({ request, requester }) => (
                <div key={request.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span>{requester.name}</span>
                    {request.reviewNote ? (
                      <span className="text-muted-foreground text-xs">Note: {request.reviewNote}</span>
                    ) : null}
                  </div>
                  <Badge variant={request.status === "approved" ? "success" : "destructive"}>
                    {request.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

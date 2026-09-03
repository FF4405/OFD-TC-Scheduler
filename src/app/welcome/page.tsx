import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { BrandedAuthCard } from "@/components/branded-auth-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { accessRequests } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

import { WelcomeForm } from "./welcome-form";

export const dynamic = "force-dynamic";

// Deliberately outside the (app) route group — a full-screen splash with no
// nav, and it's the one page an inactive-with-nothing-pending user is
// allowed to reach (see (app)/layout.tsx's redirect here), so it can't sit
// under the layout that redirects to it without looping.
export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isActive) redirect("/");

  const db = getDb();
  const [pending] = await db
    .select({ id: accessRequests.id })
    .from(accessRequests)
    .where(and(eq(accessRequests.userId, user.id), eq(accessRequests.status, "pending")))
    .limit(1);
  if (pending) redirect("/");

  const hasName = user.name !== user.email;
  const hasLineNumber = Boolean(user.lineNumber);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <BrandedAuthCard className="max-w-lg">
        <CardHeader>
          <CardTitle>{hasName ? `Welcome back, ${user.name}` : "Welcome"}</CardTitle>
          <CardDescription className="flex flex-col gap-2 text-sm">
            <span>
              This tool schedules the Oradell Fire Department&apos;s weekly truck company apparatus
              and equipment checks, and tracks who&apos;s completed theirs.
            </span>
            <span>Tell us who you are and we&apos;ll get your request in front of an admin.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WelcomeForm hasName={hasName} hasLineNumber={hasLineNumber} />
        </CardContent>
      </BrandedAuthCard>
    </div>
  );
}

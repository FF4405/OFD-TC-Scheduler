import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { canManageSchedule } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";

import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageSchedule(user)) redirect("/");

  const db = getDb();
  const initial = await getSettings(db);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Reminder timing and rotation scheduling.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm initial={initial} />
        </CardContent>
      </Card>
    </div>
  );
}

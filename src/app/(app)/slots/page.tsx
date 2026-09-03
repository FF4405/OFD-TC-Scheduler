import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { assignmentSlots } from "@/db/schema";
import { isAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

import { DeleteSlotButton } from "./delete-slot-button";
import { SlotFormDialog } from "./slot-form-dialog";

export const dynamic = "force-dynamic";

export default async function SlotsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  const db = getDb();
  const slots = await db.select().from(assignmentSlots).orderBy(assignmentSlots.sortOrder);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Slots</CardTitle>
          <SlotFormDialog trigger={<Button size="sm">Add slot</Button>} />
        </CardHeader>
        <CardContent>
          {slots.length === 0 ? (
            <p className="text-muted-foreground text-sm">No slots yet.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {slots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <div className="font-medium">
                      {slot.apparatusName} — {slot.slotType}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {slot.oicName ? `OIC: ${slot.oicName}` : null}
                      {slot.rotationNote ? ` · ${slot.rotationNote}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <SlotFormDialog
                      slot={slot}
                      trigger={
                        <button type="button" className="text-xs underline underline-offset-2">
                          Edit
                        </button>
                      }
                    />
                    <DeleteSlotButton slotId={slot.id} name={`${slot.apparatusName} — ${slot.slotType}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

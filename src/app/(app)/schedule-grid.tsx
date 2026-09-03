"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { Bell, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtWeekHeader } from "@/lib/format-date";

import { NotifyDialog } from "./notify-dialog";
import { toggleCompletion } from "./schedule-actions";

export type ScheduleWeekCell = {
  weekDate: string;
  label: string | null;
  done: boolean;
  completedBy: string | null;
  isFuture: boolean;
};

export type ScheduleRow = {
  id: string;
  memberId: string | null;
  memberName: string | null;
  apparatusName: string;
  slotType: string;
  rotationNote: string | null;
  oicName: string | null;
  weekData: ScheduleWeekCell[];
};

export type OicGroup = { oic: string; rows: ScheduleRow[] };

function Cell({ assignmentId, cell, canEdit }: { assignmentId: string; cell: ScheduleWeekCell; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(cell.done);

  function toggle() {
    if (cell.isFuture || !canEdit) return;
    const next = !done;
    setDone(next);
    startTransition(async () => {
      try {
        await toggleCompletion(assignmentId, cell.weekDate, !next);
      } catch {
        setDone(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={cell.isFuture || !canEdit || isPending}
      title={cell.completedBy ? `Completed by ${cell.completedBy}` : undefined}
      className={cn(
        "flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md border text-xs transition-colors",
        cell.isFuture
          ? "border-border/50 text-muted-foreground/50 cursor-not-allowed"
          : done
            ? "border-success bg-success/15 text-success-foreground hover:bg-success/25 cursor-pointer"
            : "border-warning bg-warning/10 text-warning-foreground hover:bg-warning/20 cursor-pointer",
        isPending && "opacity-50",
      )}
    >
      {cell.label ? <span className="font-medium">{cell.label}</span> : null}
      {done ? <Check className="size-4" /> : null}
    </button>
  );
}

export function ScheduleGrid({
  periodId,
  weeks,
  oicGroups,
  currentWeek,
  canEdit,
}: {
  periodId: string;
  weeks: string[];
  oicGroups: OicGroup[];
  currentWeek: string | null;
  canEdit: boolean;
}) {
  const [notifyOpen, setNotifyOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {currentWeek && canEdit ? (
        <div>
          <Button variant="outline" size="sm" onClick={() => setNotifyOpen(true)}>
            <Bell /> Remind pending — week of {fmtWeekHeader(currentWeek)}
          </Button>
          <NotifyDialog
            open={notifyOpen}
            onOpenChange={setNotifyOpen}
            periodId={periodId}
            weekDate={currentWeek}
            target="pending"
          />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="min-w-[220px] px-3 py-2 text-left font-medium">Apparatus / Check</th>
              <th className="min-w-[140px] px-3 py-2 text-left font-medium">Assigned</th>
              {weeks.map((w) => (
                <th
                  key={w}
                  className={cn(
                    "px-2 py-2 text-center font-medium whitespace-nowrap",
                    w === currentWeek && "bg-accent text-accent-foreground",
                  )}
                >
                  {fmtWeekHeader(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {oicGroups.map((group, groupIndex) => (
              <Fragment key={group.oic ? `oic-${group.oic}-${groupIndex}` : `group-${groupIndex}`}>
                {group.oic ? (
                  <tr key={`oic-${group.oic}`} className="bg-secondary/60">
                    <td colSpan={2 + weeks.length} className="text-muted-foreground px-3 py-1 text-xs font-semibold">
                      {group.oic}
                    </td>
                  </tr>
                ) : null}
                {group.rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{row.apparatusName}</div>
                      <div className="text-muted-foreground text-xs">{row.slotType}</div>
                      {row.rotationNote ? (
                        <div className="text-muted-foreground text-xs italic">{row.rotationNote}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {row.memberId ? (
                        <Link href={`/members/${row.memberId}`} className="underline underline-offset-2">
                          {row.memberName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>
                    {row.weekData.map((cell) => (
                      <td key={cell.weekDate} className="p-1.5 align-top">
                        <Cell assignmentId={row.id} cell={cell} canEdit={canEdit} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

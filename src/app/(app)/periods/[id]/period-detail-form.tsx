"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { updatePeriodAssignments } from "../actions";

type Slot = { id: string; apparatusName: string; slotType: string; oicName: string | null; isRepeat: boolean };
type Member = { id: string; name: string; lineNumber: string | null };
type OicGroup = { oic: string; slots: Slot[] };

export function PeriodDetailForm({
  periodId,
  periodName,
  isCurrentInitial,
  oicGroups,
  members,
  initialAssignments,
}: {
  periodId: string;
  periodName: string;
  isCurrentInitial: boolean;
  oicGroups: OicGroup[];
  members: Member[];
  initialAssignments: Record<string, string | null>;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(periodName);
  const [isCurrent, setIsCurrent] = useState(isCurrentInitial);
  const [assignments, setAssignments] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initialAssignments).map(([slotId, memberId]) => [slotId, memberId ?? ""])),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unassignedCount = useMemo(
    () => oicGroups.flatMap((g) => g.slots).filter((s) => !assignments[s.id]).length,
    [oicGroups, assignments],
  );

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updatePeriodAssignments(periodId, {
          name,
          isCurrent,
          assignments: oicGroups
            .flatMap((g) => g.slots)
            .map((s) => ({ slotId: s.id, memberId: assignments[s.id] || null })),
        });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="period-name">Period name</Label>
          <Input id="period-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Label className="mb-2 flex items-center gap-2">
          <Checkbox checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} />
          Current period
        </Label>
      </div>

      {unassignedCount > 0 ? (
        <div className="text-warning-foreground bg-warning/20 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          {unassignedCount} slot{unassignedCount > 1 ? "s" : ""} unassigned
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {oicGroups.map((group) => (
          <div key={group.oic || "none"} className="flex flex-col gap-2">
            {group.oic ? <div className="text-muted-foreground text-xs font-semibold">{group.oic}</div> : null}
            {group.slots.map((slot) => (
              <div key={slot.id} className="flex flex-wrap items-center gap-3 rounded-md border p-2">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-medium">{slot.apparatusName}</div>
                  <div className="text-muted-foreground text-xs">{slot.slotType}</div>
                </div>
                {slot.isRepeat ? <Badge variant="warning">Repeat</Badge> : null}
                <Select
                  value={assignments[slot.id] || "__unassigned"}
                  onValueChange={(value) =>
                    setAssignments((prev) => ({ ...prev, [slot.id]: value === "__unassigned" ? "" : value }))
                  }
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.lineNumber ? `#${m.lineNumber} ` : ""}
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        ))}
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div>
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : saved ? (
            <>
              <Check /> Saved
            </>
          ) : (
            "Save assignments"
          )}
        </Button>
      </div>
    </div>
  );
}

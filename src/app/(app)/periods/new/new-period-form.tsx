"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPeriodEndDate, getPeriodWeeks } from "@/lib/dates";
import { fmtLongDate, fmtWeekHeader } from "@/lib/format-date";

import { createPeriod } from "../actions";

type Slot = { id: string; apparatusName: string; slotType: string; oicName: string | null };
type Member = { id: string; name: string; lineNumber: string | null };
type OicGroup = { oic: string; slots: Slot[] };

export function NewPeriodForm({
  oicGroups,
  members,
  secondMondays,
  currentAssignments,
}: {
  oicGroups: OicGroup[];
  members: Member[];
  secondMondays: string[];
  currentAssignments: Record<string, string | null>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(secondMondays[0] ?? "");
  const [name, setName] = useState(
    secondMondays[0]
      ? new Date(secondMondays[0] + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "",
  );
  const [assignments, setAssignments] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(currentAssignments).map(([slotId, memberId]) => [slotId, memberId ?? ""])),
  );
  const [error, setError] = useState<string | null>(null);

  const weeks = useMemo(() => (startDate ? getPeriodWeeks(startDate) : []), [startDate]);
  const endDate = useMemo(() => (startDate ? getPeriodEndDate(startDate) : ""), [startDate]);
  const unassignedCount = oicGroups.flatMap((g) => g.slots).filter((s) => !assignments[s.id]).length;

  function onStartDateChange(value: string) {
    setStartDate(value);
    setName(new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await createPeriod({
          name,
          startDate,
          weekCount: weeks.length,
          assignments: oicGroups
            .flatMap((g) => g.slots)
            .map((s) => ({ slotId: s.id, memberId: assignments[s.id] || null })),
        });
        router.push(`/periods/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create period.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="period-start-date">Start date (2nd Monday)</Label>
          <Select value={startDate} onValueChange={onStartDateChange}>
            <SelectTrigger id="period-start-date" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {secondMondays.map((d) => (
                <SelectItem key={d} value={d}>
                  {fmtLongDate(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="period-name">Period name</Label>
          <Input id="period-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      {startDate ? (
        <div className="bg-muted flex flex-wrap items-center gap-3 rounded-md p-3 text-sm">
          <span className="font-medium">
            {fmtLongDate(startDate)} – {fmtLongDate(endDate)}
          </span>
          <span className="text-muted-foreground">{weeks.length} weeks</span>
          <span className="text-muted-foreground">Mondays: {weeks.map(fmtWeekHeader).join(", ")}</span>
        </div>
      ) : null}

      {unassignedCount > 0 ? (
        <div className="text-warning-foreground bg-warning/20 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          {unassignedCount} slot{unassignedCount > 1 ? "s" : ""} still unassigned
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
        <Button onClick={submit} disabled={isPending || !name.trim() || !startDate}>
          {isPending ? "Creating…" : "Create period & set as current"}
        </Button>
      </div>
    </div>
  );
}

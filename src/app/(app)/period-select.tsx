"use client";

import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtShortDate } from "@/lib/format-date";

export function PeriodSelect({
  periods,
  selectedId,
}: {
  periods: { id: string; name: string; startDate: string; isCurrent: boolean }[];
  selectedId: string;
}) {
  const router = useRouter();

  return (
    <Select value={selectedId} onValueChange={(value) => router.push(`/?period=${value}`)}>
      <SelectTrigger className="w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {periods.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name} ({fmtShortDate(p.startDate)}){p.isCurrent ? " · Current" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

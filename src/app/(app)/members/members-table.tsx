"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { MemberFormDialog, type EditableMember } from "./member-form-dialog";

export type MemberListItem = EditableMember & {
  queueRank: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  officer: "Officer",
  "50yr": "50-Year",
  inactive: "Inactive",
  retired: "Retired",
};

export function MembersTable({ members, canManage }: { members: MemberListItem[]; canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.lineNumber ?? "").toLowerCase().includes(q);
      const matchesStatus = status === "all" || m.rosterStatus === status;
      return matchesSearch && matchesStatus;
    });
  }, [members, search, status]);

  const activeCount = filtered.filter((m) => m.rosterActive).length;
  const inactiveCount = filtered.length - activeCount;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search name, email, line #…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs">
            {activeCount} active · {inactiveCount} inactive
          </span>
        </div>
        {canManage ? (
          <MemberFormDialog trigger={<Button size="sm">Add member</Button>} />
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-muted/50 border-b text-xs">
              <th className="px-3 py-2 font-medium">Queue</th>
              <th className="px-3 py-2 font-medium">Line #</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Remarks</th>
              {canManage ? <th className="px-3 py-2 font-medium">Edit</th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="text-muted-foreground px-3 py-2">{m.queueRank ?? "—"}</td>
                <td className="px-3 py-2">{m.lineNumber ?? "—"}</td>
                <td className="px-3 py-2">
                  <Link href={`/members/${m.id}`} className="font-medium underline underline-offset-2">
                    {m.name}
                  </Link>
                  {!m.rosterActive ? (
                    <Badge variant="secondary" className="ml-2">
                      Inactive
                    </Badge>
                  ) : null}
                </td>
                <td className="text-muted-foreground px-3 py-2">{m.isPlaceholder ? "—" : m.email}</td>
                <td className="px-3 py-2">{STATUS_LABEL[m.rosterStatus] ?? m.rosterStatus}</td>
                <td className="text-muted-foreground px-3 py-2">{m.remarks ?? ""}</td>
                {canManage ? (
                  <td className="px-3 py-2">
                    <MemberFormDialog
                      member={m}
                      trigger={
                        <button type="button" className="text-xs underline underline-offset-2">
                          Edit
                        </button>
                      }
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

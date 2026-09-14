import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { canManageRoster } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { sortByLineNumber } from "@/lib/members-sort";

import { MembersTable, type MemberListItem } from "./members-table";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();
  const allMembers = sortByLineNumber(await db.select().from(users));

  // Rotation queue rank (1 = next up) among active eligible members —
  // always just their position in line-number order, so this column can
  // never disagree with the Line # column next to it.
  const rotationOrdered = allMembers.filter((m) => m.rosterActive && m.rosterStatus !== "retired");
  const rankMap = new Map(rotationOrdered.map((m, i) => [m.id, i + 1]));

  const members: MemberListItem[] = allMembers.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    lineNumber: m.lineNumber,
    rosterStatus: m.rosterStatus,
    remarks: m.remarks,
    rosterActive: m.rosterActive,
    isPlaceholder: m.isPlaceholder,
    queueRank: rankMap.get(m.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-xl font-semibold">Members</h1>
      <MembersTable members={members} canManage={canManageRoster(user)} />
    </div>
  );
}

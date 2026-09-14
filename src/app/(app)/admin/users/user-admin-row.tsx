"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";

import { setUserActive, setUserAdmin } from "./actions";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  lineNumber: string | null;
  isAdmin: boolean;
  isActive: boolean;
  isPlaceholder: boolean;
};

export function UserAdminRow({ user }: { user: AdminUser }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleActive() {
    startTransition(() => {
      setUserActive(user.id, !user.isActive);
    });
  }

  function toggleAdmin() {
    setError(null);
    startTransition(async () => {
      try {
        await setUserAdmin(user.id, !user.isAdmin);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update roles.");
      }
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <Link href={`/members/${user.id}`} className="text-sm font-medium underline underline-offset-2">
            {user.name}
          </Link>
          {user.isPlaceholder ? <Badge variant="secondary">No login yet</Badge> : null}
          {!user.isActive ? <Badge variant="destructive">Inactive</Badge> : null}
        </div>
      </td>
      <td className="text-muted-foreground py-2 pr-4">{user.lineNumber ?? "—"}</td>
      <td className="py-2 pr-4">
        <div className="max-w-[240px] break-words">{user.email}</div>
      </td>
      <td className="py-2 pr-4">
        <button
          type="button"
          onClick={toggleAdmin}
          disabled={isPending}
          className="text-sm underline underline-offset-2"
        >
          {user.isAdmin ? "Admin" : "Member"}
        </button>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </td>
      <td className="py-2">
        <button type="button" onClick={toggleActive} disabled={isPending} className="text-muted-foreground text-xs underline">
          {user.isActive ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  );
}

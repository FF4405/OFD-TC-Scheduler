"use client";

import { useTransition } from "react";

import { deleteSlot } from "./actions";

export function DeleteSlotButton({ slotId, name }: { slotId: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Remove "${name}" slot?`)) return;
        startTransition(() => deleteSlot(slotId));
      }}
      className="text-destructive text-xs underline underline-offset-2"
    >
      Remove
    </button>
  );
}

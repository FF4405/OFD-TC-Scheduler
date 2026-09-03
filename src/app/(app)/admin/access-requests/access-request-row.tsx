"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { approveAccessRequest, denyAccessRequest } from "./actions";

export function AccessRequestRow({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();
  const [showDeny, setShowDeny] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approveAccessRequest(requestId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to approve.");
      }
    });
  }

  function handleDeny() {
    setError(null);
    startTransition(async () => {
      try {
        await denyAccessRequest(requestId, note);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to deny.");
      }
    });
  }

  if (showDeny) {
    return (
      <div className="flex w-56 flex-col gap-2">
        <Textarea
          placeholder="Note for the requester (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          disabled={isPending}
        />
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={handleDeny} disabled={isPending}>
            Confirm deny
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowDeny(false);
              setError(null);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleApprove} disabled={isPending}>
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowDeny(true)} disabled={isPending}>
          Deny
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { submitAccessRequest, type RequestAccessState } from "./actions";

export function RequestAccessForm() {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<RequestAccessState>({});

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setState(await submitAccessRequest());
        });
      }}
    >
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state.success ? (
        <p className="text-success text-sm">Request submitted — an admin will review it.</p>
      ) : (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Submitting…" : "Request access"}
        </Button>
      )}
    </form>
  );
}

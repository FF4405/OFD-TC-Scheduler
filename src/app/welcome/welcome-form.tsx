"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { completeOnboarding, type WelcomeState } from "./actions";

const initialState: WelcomeState = {};

export function WelcomeForm({ hasName, hasLineNumber }: { hasName: boolean; hasLineNumber: boolean }) {
  const [state, formAction, isPending] = useActionState(completeOnboarding, initialState);
  const [fullName, setFullName] = useState("");
  const [lineNumber, setLineNumber] = useState("");

  const missingRequiredField = !hasName && !fullName.trim();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        formAction({ fullName, lineNumber });
      }}
    >
      {!hasName ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="full-name">Full name</Label>
          <Input
            id="full-name"
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Jane Doe"
          />
        </div>
      ) : null}

      {!hasLineNumber ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="line-number">Line # (optional)</Label>
          <Input
            id="line-number"
            value={lineNumber}
            onChange={(event) => setLineNumber(event.target.value)}
            placeholder="33"
          />
        </div>
      ) : null}

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      <Button type="submit" disabled={isPending || missingRequiredField}>
        {isPending ? "Submitting…" : "Request access"}
      </Button>
    </form>
  );
}

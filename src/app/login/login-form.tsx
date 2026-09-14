"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { submitLogin, type LoginState } from "./actions";

const initialState: LoginState = { step: "email", email: "" };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(submitLogin, initialState);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  if (state.step === "email") {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          formAction({ step: "email", email });
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@oradellfire.org"
          />
        </div>
        {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
        <Button type="submit" disabled={isPending || !email}>
          {isPending ? "Sending…" : "Send sign-in code"}
        </Button>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        formAction({ step: "code", email: state.email, code });
      }}
    >
      <p className="text-muted-foreground text-sm">
        We sent a 6-digit code to <span className="font-medium">{state.email}</span>.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Sign-in code</Label>
        <Input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="123456"
        />
      </div>
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      <Button type="submit" disabled={isPending || code.length !== 6}>
        {isPending ? "Verifying…" : "Sign in"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => formAction({ step: "email", email: state.email })}
      >
        Resend code
      </Button>
    </form>
  );
}

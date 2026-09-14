"use server";

import { redirect } from "next/navigation";

import { normalizeEmail, requestOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, destroySession, findOrCreateUser } from "@/lib/auth/session";

export type LoginState = {
  step: "email" | "code";
  email: string;
  error?: string;
};

export type LoginInput =
  | { step: "email"; email: string }
  | { step: "code"; email: string; code: string };

export async function submitLogin(_prevState: LoginState, input: LoginInput): Promise<LoginState> {
  if (input.step === "email") {
    const result = await requestOtp(input.email);
    if (!result.ok) return { step: "email", email: input.email, error: result.error };
    return { step: "code", email: normalizeEmail(input.email) };
  }

  const result = await verifyOtp(input.email, input.code);
  if (!result.ok) return { step: "code", email: input.email, error: result.error };

  const user = await findOrCreateUser(normalizeEmail(input.email));
  await createSession(user.id);

  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

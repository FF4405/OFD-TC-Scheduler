import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { otpCodes } from "@/db/schema";
import { sendEmail } from "@/lib/email/sender";
import { otpCodeEmail } from "@/lib/email/templates";

import { sha256Hex } from "./crypto";
import { isAllowedEmailDomain, isValidEmail, normalizeEmail } from "./validation";

export { normalizeEmail };

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

// Comma-separated list of domains (e.g. "oradellfire.org") allowed to
// request a sign-in code at all. Empty means unrestricted, which should
// never be the case in production.
const ALLOWED_EMAIL_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

export function generateCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => (byte % 10).toString()).join("");
}

export type RequestOtpResult = { ok: true } | { ok: false; error: string };

export async function requestOtp(rawEmail: string): Promise<RequestOtpResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  // Deliberately generic — don't reveal which domains are allowed to an
  // unauthenticated caller.
  if (!isAllowedEmailDomain(email, ALLOWED_EMAIL_DOMAINS)) {
    return { ok: false, error: "That email isn't eligible to sign in here." };
  }

  const db = getDb();
  const [mostRecent] = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.email, email))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (mostRecent && !mostRecent.consumedAt) {
    const age = Date.now() - mostRecent.createdAt.getTime();
    if (age < RESEND_COOLDOWN_MS) {
      return { ok: false, error: "A code was just sent — wait a bit before requesting another." };
    }
  }

  const code = generateCode();
  const codeHash = await sha256Hex(code);

  await db.insert(otpCodes).values({
    id: crypto.randomUUID(),
    email,
    codeHash,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  if (process.env.NODE_ENV !== "production") {
    // Local dev convenience — Mailgun credentials are typically unset
    // outside production, so print the code instead of requiring them.
    console.log(`[dev] OTP code for ${email}: ${code}`);
  }

  const { subject, html } = otpCodeEmail({ code });
  try {
    await sendEmail({ to: [email], subject, html });
  } catch (error) {
    console.error("Failed to send OTP email", error);
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "Couldn't send the code — try again in a moment." };
    }
  }

  return { ok: true };
}

export type VerifyOtpResult = { ok: true } | { ok: false; error: string };

// Consumes the most recently requested, unexpired code for this email if it
// matches. Doesn't create or look up a user — see lib/auth/session.ts for
// what happens next on success.
export async function verifyOtp(rawEmail: string, rawCode: string): Promise<VerifyOtpResult> {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.trim();

  const db = getDb();
  const [latest] = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.email, email))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!latest || latest.consumedAt) {
    return { ok: false, error: "Request a new code." };
  }
  if (latest.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "That code expired — request a new one." };
  }
  if (latest.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts — request a new code." };
  }

  const codeHash = await sha256Hex(code);
  if (codeHash !== latest.codeHash) {
    await db
      .update(otpCodes)
      .set({ attempts: latest.attempts + 1 })
      .where(eq(otpCodes.id, latest.id));
    return { ok: false, error: "Incorrect code." };
  }

  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, latest.id));
  return { ok: true };
}

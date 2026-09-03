// Shared by otp.ts (hashing codes) and session.ts (hashing session tokens)
// so neither a DB dump nor a backup ever contains a usable code or a
// hijackable cookie value — only its hash is ever persisted.
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

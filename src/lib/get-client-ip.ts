import { headers } from "next/headers";

// Cloudflare sets CF-Connecting-IP on every request reaching the Worker —
// more reliable than X-Forwarded-For, which can be spoofed upstream of it.
export async function getClientIp(): Promise<string | null> {
  const headerList = await headers();
  return headerList.get("cf-connecting-ip") ?? headerList.get("x-forwarded-for") ?? null;
}

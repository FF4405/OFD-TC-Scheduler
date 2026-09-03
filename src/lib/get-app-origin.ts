import { headers } from "next/headers";

// The origin to build absolute links into emails (review URLs, etc.) from
// — read off the request's own Host header rather than an env var so it
// stays correct across preview deploys and custom domains alike.
export async function getAppOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

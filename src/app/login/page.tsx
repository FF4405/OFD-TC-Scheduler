import { redirect } from "next/navigation";

import { BrandedAuthCard } from "@/components/branded-auth-card";
import { CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

// force-dynamic for the same reason as (app)/layout.tsx: getCurrentUser()
// reads the per-request session cookie, so this must never be statically
// prerendered and served to every visitor.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <BrandedAuthCard className="max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Sign in with your email — we&apos;ll send you a one-time code.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </BrandedAuthCard>
    </div>
  );
}

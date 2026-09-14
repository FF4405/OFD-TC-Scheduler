import type { ReactNode } from "react";
import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";

// The card shell for every page a signed-out (or not-yet-onboarded) visitor
// can land on outside the app shell — /login and /welcome — so first
// impression matches the branded header AppNav shows once you're actually
// in the app (same gradient, same mark).
export function BrandedAuthCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex w-full flex-col overflow-hidden rounded-xl border shadow-md shadow-black/[0.03]",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 bg-gradient-to-r from-brand to-brand-dark px-6 py-4 text-brand-foreground">
        <Flame className="size-4" />
        <span className="text-sm font-semibold">OFD TC Scheduler</span>
      </div>
      <div className="flex flex-col gap-6 py-6">{children}</div>
    </div>
  );
}

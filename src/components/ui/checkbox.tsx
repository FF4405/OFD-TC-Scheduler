"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// A plain native checkbox styled to match the rest of the form controls —
// simpler than pulling in @radix-ui/react-checkbox for the handful of
// on/off toggles this app needs (member active, roster fields).
function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "border-input accent-primary size-4 rounded-sm border shadow-xs outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };

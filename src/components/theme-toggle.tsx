"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): Theme {
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// The server has no localStorage/matchMedia to read — render as if no
// preference is known yet. The inline script in layout.tsx (which runs
// before hydration) is what actually prevents a flash of the wrong theme;
// this is just what this component renders until it can read the real
// value on the client, right after hydration.
function getServerSnapshot(): null {
  return null;
}

function setTheme(next: Theme) {
  window.localStorage.setItem("theme", next);
  document.documentElement.setAttribute("data-theme", next);
  listeners.forEach((listener) => listener());
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      disabled={theme === null}
      aria-label={theme === null ? "Toggle theme" : `Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={className}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

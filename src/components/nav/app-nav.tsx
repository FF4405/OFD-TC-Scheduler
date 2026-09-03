import Link from "next/link";
import { ChevronDown, Flame, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import type { CurrentUser } from "@/lib/auth/session";

export function AppNav({ user }: { user: CurrentUser }) {
  // Not-yet-approved and deactivated accounts (isActive: false) only get
  // the read-only schedule and a way to ask for access — everything else
  // requires active membership and would just redirect them straight back.
  const links: { href: string; label: string }[] = user.isActive
    ? [
        { href: "/", label: "Schedule" },
        { href: "/members", label: "Members" },
        { href: "/periods", label: "Periods" },
      ]
    : [
        { href: "/", label: "Schedule" },
        { href: "/request-access", label: "Request Access" },
      ];

  const adminLinks: { href: string; label: string }[] =
    user.isActive && user.isAdmin
      ? [
          { href: "/slots", label: "Slots" },
          { href: "/settings", label: "Settings" },
          { href: "/admin/users", label: "Users" },
          { href: "/admin/access-requests", label: "Access Requests" },
        ]
      : [];

  return (
    <header className="flex items-center justify-between gap-2 bg-gradient-to-r from-brand to-brand-dark px-4 py-3 text-brand-foreground shadow-md sm:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 text-sm font-semibold">
          <Flame className="size-4" />
          OFD TC Scheduler
        </Link>
        <nav className="hidden items-center gap-4 sm:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-brand-foreground/80 text-sm transition-colors hover:text-brand-foreground"
            >
              {link.label}
            </Link>
          ))}
          {adminLinks.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-brand-foreground/80 flex items-center gap-1 text-sm transition-colors hover:text-brand-foreground"
                >
                  Admin
                  <ChevronDown className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {adminLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href}>{link.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </nav>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle className="text-brand-foreground hover:bg-white/15 hover:text-brand-foreground" />
        <span className="text-brand-foreground/80 hidden text-sm sm:inline">{user.name}</span>
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-brand-foreground hover:bg-white/15 hover:text-brand-foreground"
          >
            Sign out
          </Button>
        </form>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="border-white/30 bg-white/10 text-brand-foreground hover:bg-white/20 hover:text-brand-foreground sm:hidden"
              aria-label="Menu"
            >
              <Menu />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {links.map((link) => (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href}>{link.label}</Link>
              </DropdownMenuItem>
            ))}
            {adminLinks.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Admin</DropdownMenuLabel>
                {adminLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href}>{link.label}</Link>
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

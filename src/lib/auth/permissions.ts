import type { CurrentUser } from "./session";

// Every admin-only action in this app (member/slot/period management,
// settings, sending reminders, reviewing access requests) funnels through
// this one check — there's no officer/instructor middle tier like the
// driver-training app, since assignment scheduling doesn't need one.
export function isAdmin(user: CurrentUser): boolean {
  return user.isActive && user.isAdmin;
}

export function canReviewAccessRequests(user: CurrentUser): boolean {
  return isAdmin(user);
}

export function canManageRoster(user: CurrentUser): boolean {
  return isAdmin(user);
}

export function canManageSchedule(user: CurrentUser): boolean {
  return isAdmin(user);
}

// Marking a check complete/undone is open to any active (approved) member
// — the grid is used at the firehouse by whoever did the check, not just
// admins.
export function canMarkCompletion(user: CurrentUser): boolean {
  return user.isActive;
}

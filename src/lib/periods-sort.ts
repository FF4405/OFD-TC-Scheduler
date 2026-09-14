export type SortableAsPeriod = { startDate: string; isCurrent: boolean };

// Pins the current period at the top, with everything else beneath it in
// chronological order — every screen that lists periods (or offers a
// dropdown of them) uses this same order, so "current" always means the
// same thing everywhere.
export function sortPeriodsCurrentFirst<T extends SortableAsPeriod>(items: T[]): T[] {
  const current = items.find((p) => p.isCurrent);
  const rest = items
    .filter((p) => p !== current)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  return current ? [current, ...rest] : rest;
}

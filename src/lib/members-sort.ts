export type SortableByLineNumber = { lineNumber: string | null; name: string };

// Members with no line number sort last, tied-broken by name. The single
// definition of "line number order" — the members list, assignment
// dropdowns, and the auto-generate rotation cycle all call this, so it's
// never possible for one of them to disagree with another.
export function sortByLineNumber<T extends SortableByLineNumber>(members: T[]): T[] {
  return members.slice().sort((a, b) => {
    const an = a.lineNumber ? parseInt(a.lineNumber, 10) : Infinity;
    const bn = b.lineNumber ? parseInt(b.lineNumber, 10) : Infinity;
    return an - bn || a.name.localeCompare(b.name);
  });
}

import Link from "next/link";

// Shown to a signed-in but not-yet-approved user on every page — they can
// browse the read-only schedule while their request-access submission
// (see app/(app)/request-access) is pending review.
export function PendingAccessBanner() {
  return (
    <div className="bg-warning text-warning-foreground px-4 py-2 text-center text-sm sm:px-6">
      Your access request is pending admin approval. You can view the schedule, but can&apos;t make
      changes yet.{" "}
      <Link href="/request-access" className="font-medium underline underline-offset-2">
        View your request
      </Link>
    </div>
  );
}

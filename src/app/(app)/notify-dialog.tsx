"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Mail, MailWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtLongDate } from "@/lib/format-date";

import { previewReminders, sendReminders, type NotifyRecipient } from "./schedule-actions";

export function NotifyDialog({
  open,
  onOpenChange,
  periodId,
  weekDate,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  weekDate: string;
  target: string | "pending";
}) {
  const [isPending, startTransition] = useTransition();
  const [recipients, setRecipients] = useState<NotifyRecipient[] | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setRecipients(null);
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        setRecipients(await previewReminders(periodId, weekDate, target));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recipients.");
      }
    });
  }

  function send() {
    startTransition(async () => {
      try {
        setResult(await sendReminders(periodId, weekDate, target));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send reminders.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next && recipients === null) load();
        if (!next) {
          setRecipients(null);
          setResult(null);
          setError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send reminders</DialogTitle>
          <DialogDescription>Week of {fmtLongDate(weekDate)}</DialogDescription>
        </DialogHeader>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {result ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="text-success size-8" />
            <p className="font-semibold">Reminders sent</p>
            <p className="text-muted-foreground text-sm">
              <span className="text-success font-medium">{result.sent} sent</span>
              {result.failed > 0 ? (
                <>
                  {" "}
                  · <span className="text-destructive font-medium">{result.failed} failed</span>
                </>
              ) : null}
            </p>
          </div>
        ) : recipients === null ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {isPending ? "Loading…" : "—"}
          </p>
        ) : recipients.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="text-success size-8" />
            <p className="font-semibold">All checks complete for this week!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">
              {recipients.length} member{recipients.length !== 1 ? "s" : ""} pending:
            </p>
            <div className="flex flex-col gap-2">
              {recipients.map((r) => (
                <div key={r.assignmentId} className="border-border flex items-start justify-between gap-2 rounded-md border p-2 text-sm">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-muted-foreground text-xs">{r.slot}</div>
                    {r.email ? (
                      <div className="text-muted-foreground text-xs">{r.email}</div>
                    ) : (
                      <div className="text-warning text-xs">No email on file</div>
                    )}
                  </div>
                  {r.email ? <Mail className="text-muted-foreground size-4 shrink-0" /> : <MailWarning className="text-warning size-4 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {recipients && recipients.length > 0 && !result ? (
          <DialogFooter>
            <Button onClick={send} disabled={isPending}>
              {isPending ? "Sending…" : `Send ${recipients.filter((r) => r.email).length} email${recipients.filter((r) => r.email).length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

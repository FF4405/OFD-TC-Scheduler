"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { addMember, updateMember, type MemberInput } from "./actions";

const STATUS_OPTIONS: { value: MemberInput["rosterStatus"]; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "officer", label: "Officer" },
  { value: "50yr", label: "50-Year" },
  { value: "inactive", label: "Inactive" },
  { value: "retired", label: "Retired" },
];

export type EditableMember = {
  id: string;
  name: string;
  email: string;
  lineNumber: string | null;
  rosterStatus: MemberInput["rosterStatus"];
  remarks: string | null;
  rosterActive: boolean;
  isPlaceholder: boolean;
};

function emptyInput(): MemberInput {
  return { name: "", email: "", lineNumber: "", rosterStatus: "active", remarks: "", rosterActive: true };
}

function fromMember(member: EditableMember): MemberInput {
  return {
    name: member.name,
    email: member.isPlaceholder ? "" : member.email,
    lineNumber: member.lineNumber ?? "",
    rosterStatus: member.rosterStatus,
    remarks: member.remarks ?? "",
    rosterActive: member.rosterActive,
  };
}

export function MemberFormDialog({
  member,
  trigger,
}: {
  member?: EditableMember;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [input, setInput] = useState<MemberInput>(member ? fromMember(member) : emptyInput());
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setInput(member ? fromMember(member) : emptyInput());
      setError(null);
    }
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        if (member) {
          await updateMember(member.id, input);
        } else {
          await addMember(input);
        }
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save member.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? "Edit member" : "Add member"}</DialogTitle>
          <DialogDescription>
            {member ? "Update this member's roster details." : "New members are placed at the back of the rotation queue."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="m-line">Line #</Label>
              <Input id="m-line" value={input.lineNumber} onChange={(e) => setInput({ ...input, lineNumber: e.target.value })} />
            </div>
            <div className="flex flex-[2] flex-col gap-1.5">
              <Label htmlFor="m-name">Name</Label>
              <Input id="m-name" value={input.name} onChange={(e) => setInput({ ...input, name: e.target.value })} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-email">Email {member?.isPlaceholder ? "(no login yet)" : ""}</Label>
            <Input
              id="m-email"
              type="email"
              value={input.email}
              onChange={(e) => setInput({ ...input, email: e.target.value })}
              placeholder="name@oradellfire.org"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-status">Status</Label>
            <Select value={input.rosterStatus} onValueChange={(v) => setInput({ ...input, rosterStatus: v as MemberInput["rosterStatus"] })}>
              <SelectTrigger id="m-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-remarks">Remarks</Label>
            <Textarea id="m-remarks" rows={2} value={input.remarks} onChange={(e) => setInput({ ...input, remarks: e.target.value })} />
          </div>

          <Label className="flex items-center gap-2">
            <Checkbox
              checked={input.rosterActive}
              onChange={(e) => setInput({ ...input, rosterActive: e.target.checked })}
            />
            Active in rotation
          </Label>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={isPending || !input.name.trim()}>
            {isPending ? "Saving…" : member ? "Save changes" : "Add member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

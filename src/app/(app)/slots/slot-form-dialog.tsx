"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
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

import { addSlot, updateSlot, type SlotInput } from "./actions";

export type EditableSlot = {
  id: string;
  apparatusName: string;
  slotType: string;
  rotationNote: string | null;
  rotationLabels: string | null;
  oicName: string | null;
};

function emptyInput(): SlotInput {
  return { apparatusName: "", slotType: "", rotationNote: "", rotationLabels: "", oicName: "" };
}

function fromSlot(slot: EditableSlot): SlotInput {
  let labels = "";
  if (slot.rotationLabels) {
    try {
      labels = (JSON.parse(slot.rotationLabels) as string[]).join(", ");
    } catch {
      labels = "";
    }
  }
  return {
    apparatusName: slot.apparatusName,
    slotType: slot.slotType,
    rotationNote: slot.rotationNote ?? "",
    rotationLabels: labels,
    oicName: slot.oicName ?? "",
  };
}

export function SlotFormDialog({ slot, trigger }: { slot?: EditableSlot; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [input, setInput] = useState<SlotInput>(slot ? fromSlot(slot) : emptyInput());
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setInput(slot ? fromSlot(slot) : emptyInput());
      setError(null);
    }
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        if (slot) await updateSlot(slot.id, input);
        else await addSlot(input);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save slot.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{slot ? "Edit slot" : "Add slot"}</DialogTitle>
          <DialogDescription>One row in the schedule grid — an apparatus/equipment check.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-apparatus">Apparatus</Label>
            <Input id="s-apparatus" value={input.apparatusName} onChange={(e) => setInput({ ...input, apparatusName: e.target.value })} placeholder="Tower 21" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-type">Check type</Label>
            <Input id="s-type" value={input.slotType} onChange={(e) => setInput({ ...input, slotType: e.target.value })} placeholder="Apparatus & Equipment" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-oic">OIC</Label>
            <Input id="s-oic" value={input.oicName} onChange={(e) => setInput({ ...input, oicName: e.target.value })} placeholder="Lt. Jaimes" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-note">Rotation note</Label>
            <Input id="s-note" value={input.rotationNote} onChange={(e) => setInput({ ...input, rotationNote: e.target.value })} placeholder="Alternate sides each week" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-labels">Weekly labels (comma-separated, cycles)</Label>
            <Input id="s-labels" value={input.rotationLabels} onChange={(e) => setInput({ ...input, rotationLabels: e.target.value })} placeholder="Officer, Driver" />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={isPending || !input.apparatusName.trim() || !input.slotType.trim()}>
            {isPending ? "Saving…" : slot ? "Save changes" : "Add slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

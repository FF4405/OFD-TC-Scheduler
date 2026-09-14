"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SettingsMap } from "@/lib/settings";

import { updateSettings } from "./actions";
import { autoGeneratePeriods } from "../periods/actions";

const DAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export function SettingsForm({ initial }: { initial: SettingsMap }) {
  const [values, setValues] = useState<SettingsMap>(initial);
  const [isSaving, startSaving] = useTransition();
  const [isGenerating, startGenerating] = useTransition();
  const [saved, setSaved] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    startSaving(async () => {
      try {
        await updateSettings(values);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save settings.");
      }
    });
  }

  function generate() {
    setGenMessage(null);
    setError(null);
    startGenerating(async () => {
      try {
        const result = await autoGeneratePeriods();
        setGenMessage(
          result.created === 0
            ? (result.message ?? "All periods already exist")
            : `Created ${result.created} period${result.created !== 1 ? "s" : ""}`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to auto-generate periods.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notify-day">Reminder day</Label>
          <Select value={values.notify_day} onValueChange={(v) => setValues({ ...values, notify_day: v })}>
            <SelectTrigger id="notify-day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_OPTIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notify-hour">Reminder hour (0–23, local to the department)</Label>
          <Input
            id="notify-hour"
            type="number"
            min={0}
            max={23}
            value={values.notify_hour}
            onChange={(e) => setValues({ ...values, notify_hour: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="auto-months">Auto-schedule horizon (months)</Label>
          <Input
            id="auto-months"
            type="number"
            min={1}
            max={24}
            value={values.auto_schedule_months}
            onChange={(e) => setValues({ ...values, auto_schedule_months: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Repeat threshold (miss this fraction of weeks → repeat)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={values.repeat_miss_num}
              onChange={(e) => setValues({ ...values, repeat_miss_num: e.target.value })}
              className="w-16"
            />
            <span className="text-muted-foreground">/</span>
            <Input
              type="number"
              min={1}
              value={values.repeat_miss_den}
              onChange={(e) => setValues({ ...values, repeat_miss_den: e.target.value })}
              className="w-16"
            />
          </div>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={isSaving}>
          {isSaving ? "Saving…" : saved ? (
            <>
              <Check /> Saved
            </>
          ) : (
            "Save settings"
          )}
        </Button>
      </div>

      <div className="border-t pt-4">
        <p className="text-muted-foreground mb-2 text-sm">
          Fill in periods out to the configured horizon, carrying poor-attendance members forward and
          rotating everyone else.
        </p>
        <Button variant="outline" onClick={generate} disabled={isGenerating}>
          {isGenerating ? "Generating…" : "Auto-generate periods"}
        </Button>
        {genMessage ? <p className="text-muted-foreground mt-2 text-sm">{genMessage}</p> : null}
      </div>

      <div className="text-muted-foreground border-t pt-4 text-xs">
        Monday reminders send automatically via a Cloudflare Cron Trigger — no external cron job or URL
        needed. The reminder day/hour above controls when the cron actually sends (it fires hourly and
        checks these settings); see the deployed worker&apos;s <code>scheduled</code> handler for details.
      </div>
    </div>
  );
}

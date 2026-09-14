import { format, parseISO } from "date-fns";

export function fmtShortDate(d: string): string {
  try {
    return format(parseISO(d), "M/d/yyyy");
  } catch {
    return d;
  }
}

export function fmtLongDate(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function fmtWeekHeader(d: string): string {
  try {
    const dt = new Date(d + "T00:00:00");
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  } catch {
    return d;
  }
}

export function fmtDateTime(d: Date | string): string {
  try {
    const dt = typeof d === "string" ? parseISO(d) : d;
    return format(dt, "MMM d, yyyy h:mm a");
  } catch {
    return String(d);
  }
}

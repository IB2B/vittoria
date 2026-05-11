import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  differenceInCalendarDays,
} from "date-fns";

import type { DateRange } from "@/lib/meta";

export type RangePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "last-month"
  | "custom";

const ISO = "yyyy-MM-dd";

export function presetToRange(preset: RangePreset, today = new Date()): DateRange {
  switch (preset) {
    case "today":
      return {
        since: format(today, ISO),
        until: format(today, ISO),
      };
    case "yesterday": {
      const y = subDays(today, 1);
      return {
        since: format(y, ISO),
        until: format(y, ISO),
      };
    }
    case "7d":
      return {
        since: format(subDays(today, 6), ISO),
        until: format(today, ISO),
      };
    case "30d":
      return {
        since: format(subDays(today, 29), ISO),
        until: format(today, ISO),
      };
    case "month":
      return {
        since: format(startOfMonth(today), ISO),
        until: format(today, ISO),
      };
    case "last-month": {
      const last = subMonths(today, 1);
      return {
        since: format(startOfMonth(last), ISO),
        until: format(endOfMonth(last), ISO),
      };
    }
    case "custom":
    default:
      return {
        since: format(subDays(today, 29), ISO),
        until: format(today, ISO),
      };
  }
}

// Returns the immediately-prior window of equal length (for "vs previous period").
export function previousRange(range: DateRange): DateRange {
  const since = new Date(range.since + "T00:00:00Z");
  const until = new Date(range.until + "T00:00:00Z");
  const days = differenceInCalendarDays(until, since) + 1;
  const prevUntil = subDays(since, 1);
  const prevSince = subDays(prevUntil, days - 1);
  return {
    since: format(prevSince, ISO),
    until: format(prevUntil, ISO),
  };
}

export function parseRangeFromSearchParams(
  params: { from?: string; to?: string; preset?: string },
  today = new Date(),
): { range: DateRange; preset: RangePreset } {
  const preset = (params.preset as RangePreset | undefined) ?? "7d";
  if (params.from && params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.from) && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
    return {
      range: { since: params.from, until: params.to },
      preset: "custom",
    };
  }
  return { range: presetToRange(preset, today), preset };
}

export function delta(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return (curr - prev) / prev;
}

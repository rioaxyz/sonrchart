// Resolution parsing (issue #38). A "resolution" is the bar interval token the
// host passes as `interval` (e.g. "5", "1H", "D"). KLineChart wants a
// {type, span} Period; this module is the single, pure place that maps arbitrary
// resolution tokens to a Period — so hosts can pass *custom* resolutions beyond
// the toolbar's built-in set (any span of seconds/minutes/hours/days/weeks/
// months/years) and everything downstream (period, countdown, tooltips) follows.
//
// Kept side-effect-free and framework-free so it's unit-tested directly and
// imported by `internal.ts` without pulling in React/klinecharts.
import type { PeriodType } from "klinecharts";
import type { Interval } from "./types";

/** Milliseconds in one unit of each period type. Week/month/year are nominal
 *  (calendar-agnostic) — used only for the bar-close countdown, where an exact
 *  calendar length isn't needed. */
export const UNIT_MS: Record<PeriodType, number> = {
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000, // 30d nominal
  year: 31_536_000_000, // 365d nominal
};

// Suffix → period type. Order matters only for readability; matching is exact.
// "MO" (month) is distinct from a bare number (minutes) so "30" stays 30-minute
// while "1MO" is one month.
const SUFFIX: Array<{ re: RegExp; type: PeriodType }> = [
  { re: /^(\d+)S$/, type: "second" },
  { re: /^(\d+)H$/, type: "hour" },
  { re: /^(\d+)D$/, type: "day" },
  { re: /^(\d+)W$/, type: "week" },
  { re: /^(\d+)MO$/, type: "month" },
  { re: /^(\d+)Y$/, type: "year" },
];

/**
 * Parse a resolution token to a KLineChart Period.
 *
 * Rules (case-insensitive):
 * - `<n>S` → seconds (e.g. "10S", "30S", "5S")
 * - `<n>H` → hours; bare `"60"` also maps to 1 hour (back-compat with the
 *   original interval set, where "60" meant hourly)
 * - `D` / `<n>D` → days
 * - `W` / `<n>W` → weeks
 * - `MO` / `<n>MO` → months
 * - `Y` / `<n>Y` → years
 * - `<n>` → minutes (e.g. "1", "5", "15", "240")
 * - anything unrecognized → 1 minute (safe default)
 */
export function parseResolution(interval: Interval): { type: PeriodType; span: number } {
  const raw = String(interval).trim().toUpperCase();
  // Bare unit letters (no leading number) → span 1.
  if (raw === "D" || raw === "1D") return { type: "day", span: 1 };
  if (raw === "W") return { type: "week", span: 1 };
  if (raw === "MO") return { type: "month", span: 1 };
  if (raw === "Y") return { type: "year", span: 1 };
  // "60" kept as 1 hour for back-compat with the original toolbar set.
  if (raw === "60") return { type: "hour", span: 1 };
  for (const { re, type } of SUFFIX) {
    const m = re.exec(raw);
    if (m) return { type, span: Math.max(1, parseInt(m[1], 10) || 1) };
  }
  const mins = /^(\d+)$/.exec(raw);
  if (mins) return { type: "minute", span: Math.max(1, parseInt(mins[1], 10) || 1) };
  return { type: "minute", span: 1 };
}

/** Duration of one bar at this resolution, in ms (drives the bar-close
 *  countdown). Nominal for week/month/year (see UNIT_MS). */
export function resolutionMs(interval: Interval): number {
  const { type, span } = parseResolution(interval);
  return span * UNIT_MS[type];
}

const TYPE_WORD: Record<PeriodType, string> = {
  second: "second",
  minute: "minute",
  hour: "hour",
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

/** Human words for a resolution, e.g. "30 minute", "1 hour" — used in tooltips
 *  and menus. Pure. */
export function resolutionLabel(interval: Interval): string {
  const { type, span } = parseResolution(interval);
  return `${span} ${TYPE_WORD[type]}`;
}

/** A resolution option for a resolution menu/toolbar. */
export interface ResolutionOption {
  /** The token passed as `interval`. */
  value: Interval;
  /** Short display label (e.g. "5m", "1H", "D"). */
  label: string;
}

/** A sensible default resolution set spanning seconds → months. Hosts can pass
 *  their own; any custom token `parseResolution` understands is valid. */
export const DEFAULT_RESOLUTIONS: ResolutionOption[] = [
  { value: "10S", label: "10s" },
  { value: "30S", label: "30s" },
  { value: "1", label: "1m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "30", label: "30m" },
  { value: "60", label: "1H" },
  { value: "240", label: "4H" },
  { value: "D", label: "D" },
  { value: "W", label: "W" },
  { value: "1MO", label: "M" },
];

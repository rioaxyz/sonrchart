import type { KLineData } from "klinecharts";

// Volume trend (#79): classify the volume direction of the `bars` bars ending
// at `endIndex` by comparing each bar's volume with its immediate predecessor.
// Every bar higher than the one before it → "increasing"; every bar lower →
// "decreasing"; anything else (a mix, or any flat pair) → "mixed". Needs
// `bars + 1` loaded bars (the first compared bar still needs a predecessor);
// returns null until enough data exists or when a volume is missing.

export type VolumeTrend = "increasing" | "decreasing" | "mixed";

export const DEFAULT_VOLUME_TREND_BARS = 3;

export function volumeTrend(list: KLineData[], endIndex: number, bars: number = DEFAULT_VOLUME_TREND_BARS): VolumeTrend | null {
  const n = Math.max(1, Math.floor(bars));
  if (endIndex < n || endIndex >= list.length) return null;
  let up = 0;
  let down = 0;
  for (let i = endIndex - n + 1; i <= endIndex; i++) {
    const v = list[i]?.volume;
    const pv = list[i - 1]?.volume;
    if (typeof v !== "number" || typeof pv !== "number") return null;
    if (v > pv) up++;
    else if (v < pv) down++;
  }
  if (up === n) return "increasing";
  if (down === n) return "decreasing";
  return "mixed";
}

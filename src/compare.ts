import { registerIndicator } from "klinecharts";
import type { Bar } from "./types";

// Compare / multi-symbol overlay (issue #9): draw one or more other symbols'
// price lines on the main pane, ratio-scaled so they start at the main series'
// price and diverge by relative performance (the standard "compare" behavior).

export const COMPARE_INDICATOR = "SONR_COMPARE";

export interface CompareLine {
  color: string;
  /** Aligned to the main bars: value per main-bar timestamp (null = gap). */
  points: Array<{ time: number; value: number | null }>;
}

let _registered = false;

export function registerCompareIndicator(): void {
  if (_registered) return;
  _registered = true;
  registerIndicator<Record<string, never>, unknown, CompareLine[]>({
    name: COMPARE_INDICATOR,
    shortName: "",
    series: "price",
    figures: [],
    calc: (dataList) => dataList.map(() => ({})),
    draw: ({ ctx, chart, indicator, xAxis, yAxis }) => {
      const lines = (indicator.extendData as CompareLine[]) || [];
      if (lines.length === 0) return false;

      ctx.save();
      ctx.lineWidth = 1.5;
      for (const line of lines) {
        const pts = line.points;
        const n = pts.length;
        if (n === 0) continue;
        // Compare points are 1:1 with the main bars (in order), so the visible
        // data range indexes straight into them — convert only what's on screen
        // (+1 bar of margin so line segments reach the edges).
        const range = chart.getVisibleRange();
        const from = Math.max(0, (range?.from ?? 0) - 1);
        const to = Math.min(n - 1, (range?.to ?? n - 1) + 1);
        ctx.strokeStyle = line.color;
        ctx.beginPath();
        let started = false;
        for (let i = from; i <= to; i++) {
          const p = pts[i];
          if (p.value == null) {
            started = false;
            continue;
          }
          const x = xAxis.convertTimestampToPixel(p.time);
          const y = yAxis.convertToPixel(p.value);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
      ctx.restore();
      return false;
    },
  });
}

/**
 * Align a comparison symbol's bars to the main bars by timestamp and ratio-scale
 * them so the two series share a starting price (first overlapping bar). Returns
 * one value per main bar (null where the compare symbol has no data).
 */
export function alignCompare(mainBars: Bar[], compareBars: Bar[]): Array<{ time: number; value: number | null }> {
  const byTime = new Map<number, number>();
  for (const b of compareBars) byTime.set(b.time, b.close);

  // Scale factor from the first main bar that both series cover.
  let scale = 1;
  for (const mb of mainBars) {
    const c = byTime.get(mb.time);
    if (c != null && c !== 0) {
      scale = mb.close / c;
      break;
    }
  }
  return mainBars.map((mb) => {
    const c = byTime.get(mb.time);
    return { time: mb.time, value: c == null ? null : c * scale };
  });
}

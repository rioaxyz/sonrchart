// Pure, side-effect-free helpers shared by the component and exercised directly
// by the unit tests. Kept out of SonrChart.tsx so they can be imported without
// pulling in React/klinecharts.
import type { DeepPartial, KLineData, PeriodType, Styles } from "klinecharts";
import { DEFAULT_SESSION_COLORS, type SessionColors } from "./indicators";
import type { Bar, IndicatorSpec, Interval, SessionTint } from "./types";

/** KLineChart's id for the main price pane — where the candles, watermark,
 *  session tint, pattern markers, compare series, and "main" indicators live. */
export const CANDLE_PANE = "candle_pane";

export function toKLine(b: Bar): KLineData {
  return { timestamp: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? 0 };
}

export function toPeriod(interval: Interval): { type: PeriodType; span: number } {
  if (interval === "10S") return { type: "second", span: 10 };
  if (interval === "30S") return { type: "second", span: 30 };
  if (interval === "D" || interval === "1D") return { type: "day", span: 1 };
  if (interval === "60") return { type: "hour", span: 1 };
  return { type: "minute", span: parseInt(String(interval), 10) || 1 };
}

export function asSpec(i: string | IndicatorSpec): IndicatorSpec {
  return typeof i === "string" ? { name: i } : i;
}

export function sessionColors(s: SessionTint): SessionColors {
  if (s && typeof s === "object") {
    return {
      premarket: s.premarket ?? DEFAULT_SESSION_COLORS.premarket,
      afterhours: s.afterhours ?? DEFAULT_SESSION_COLORS.afterhours,
    };
  }
  return DEFAULT_SESSION_COLORS;
}

// Shallow one-level merge so callers' style overrides win over the theme.
export function mergeStyles(base: DeepPartial<Styles>, over?: DeepPartial<Styles>): DeepPartial<Styles> {
  if (!over) return base;
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = { ...(base as Record<string, unknown>)[k] as object, ...(over as Record<string, unknown>)[k] as object };
  }
  return out as DeepPartial<Styles>;
}

import type { KLineData } from "klinecharts";

// Volume Surge: classify each bar's volume strength against the mean volume of
// the `bars` bars immediately BEFORE it (the bar itself is excluded from the
// mean, so a surge can't inflate its own baseline). A bar whose volume is at
// least `mult` × that mean is "surging" — abnormal participation for this
// stretch of tape; anything less is "continuing". The multiple is relative by
// design: a quiet stretch sets a low bar, a noisy one a high bar, so the
// question is "is this volume unusual HERE", not "is this a big-volume stock".

export type VolumeStrength = "surging" | "continuing";

/** Which side the volume pressure reads as (#99). PRESSURE, not positioning:
 *  OHLCV bars can't distinguish longs from shorts (a short sale prints like
 *  any other sell), and true buy/sell attribution needs trade-level aggressor
 *  data — this is the standard close-location inference instead. */
export type SurgeSide = "buying" | "selling" | "neutral";

export const DEFAULT_VOLUME_SURGE_BARS = 20;
export const DEFAULT_VOLUME_SURGE_MULT = 1.5;
/** |CLV| at or below this reads as "neutral", so a doji that closes mid-range
 *  isn't force-classified as one side. */
export const DEFAULT_SURGE_SIDE_DEADZONE = 0.2;

/** Close Location Value: where the close sits inside the bar's range, −1 (at
 *  the low) … +1 (at the high), 0 for a rangeless bar. This is the Money Flow
 *  Multiplier from Accumulation/Distribution — the conventional OHLCV proxy
 *  for which side absorbed the bar's volume. */
export function closeLocationValue(bar: Pick<KLineData, "high" | "low" | "close">): number {
  const range = bar.high - bar.low;
  if (!(range > 0)) return 0;
  return (bar.close - bar.low - (bar.high - bar.close)) / range;
}

/** Classify a bar's volume pressure from its CLV: a close in the top of the
 *  range is "buying" (buyers absorbed the volume and held price), the bottom
 *  "selling", and the middle dead-zone "neutral". */
export function surgeSide(bar: Pick<KLineData, "high" | "low" | "close">, deadzone: number = DEFAULT_SURGE_SIDE_DEADZONE): SurgeSide {
  const clv = closeLocationValue(bar);
  if (clv > deadzone) return "buying";
  if (clv < -deadzone) return "selling";
  return "neutral";
}

/** One bar's result. Empty (no keys set) until `bars` prior bars with usable
 *  volume exist — those bars plot nothing and read as no state. */
export interface VolumeSurgePoint {
  /** bar volume ÷ mean volume of the `bars` preceding bars */
  ratio?: number;
  /** the `mult` threshold, echoed per-bar so it can plot as a reference line */
  threshold?: number;
  strength?: VolumeStrength;
  /** CLV-inferred pressure side for the bar (#99); set whenever `strength` is. */
  side?: SurgeSide;
}

export function computeVolumeSurge(
  dataList: KLineData[],
  bars: number = DEFAULT_VOLUME_SURGE_BARS,
  mult: number = DEFAULT_VOLUME_SURGE_MULT,
): VolumeSurgePoint[] {
  const n = Math.max(1, Math.floor(bars));
  const m = mult > 0 ? mult : DEFAULT_VOLUME_SURGE_MULT;
  // Rolling sum of the trailing window keeps this O(bars) per update and O(n)
  // overall; a missing volume anywhere in the window voids that window.
  let sum = 0;
  let missing = 0;
  return dataList.map((d, i) => {
    const point: VolumeSurgePoint = {};
    if (i >= n) {
      const v = d.volume;
      if (typeof v === "number" && missing === 0 && sum > 0) {
        const mean = sum / n;
        const ratio = v / mean;
        point.ratio = ratio;
        point.threshold = m;
        point.strength = ratio >= m ? "surging" : "continuing";
        point.side = surgeSide(d);
      }
    }
    // Slide the window for the NEXT bar (its window is [i-n+1, i]): admit this
    // bar, retire the one that just fell out the back.
    const vIn = d.volume;
    if (typeof vIn === "number") sum += vIn;
    else missing++;
    if (i >= n) {
      const vOut = dataList[i - n]?.volume;
      if (typeof vOut === "number") sum -= vOut;
      else missing--;
    }
    return point;
  });
}

/** Figure/tooltip palette. Override any subset at creation or runtime via the
 *  indicator's `extendData` (the same convention the session tint uses):
 *  `createIndicator({ name: "VSURGE", extendData: { surging: "#e91e63" } })`. */
export interface VolumeSurgeColors {
  /** bar + tooltip color for a neutral-side surge (amber: an attention state
   *  that stays legible on both themes) */
  surging: string;
  /** surge whose bar closed high in its range — buying pressure (#99) */
  buying: string;
  /** surge whose bar closed low in its range — selling pressure (#99) */
  selling: string;
  /** bar + tooltip color otherwise (the toolbar's neutral gray) */
  continuing: string;
  /** dashed reference line at the `mult` threshold (muted, recedes) */
  threshold: string;
}

export const DEFAULT_VOLUME_SURGE_COLORS: VolumeSurgeColors = {
  surging: "#ff9800",
  buying: "#26a69a",
  selling: "#ef5350",
  continuing: "#9598a1",
  threshold: "#75798055",
};

/** Merge a (possibly partial, possibly absent) extendData palette over the
 *  defaults. Unknown shapes degrade to the defaults rather than throwing. */
export function volumeSurgeColors(extendData: unknown): VolumeSurgeColors {
  const d = (typeof extendData === "object" && extendData !== null ? extendData : {}) as Partial<VolumeSurgeColors>;
  return {
    surging: typeof d.surging === "string" ? d.surging : DEFAULT_VOLUME_SURGE_COLORS.surging,
    buying: typeof d.buying === "string" ? d.buying : DEFAULT_VOLUME_SURGE_COLORS.buying,
    selling: typeof d.selling === "string" ? d.selling : DEFAULT_VOLUME_SURGE_COLORS.selling,
    continuing: typeof d.continuing === "string" ? d.continuing : DEFAULT_VOLUME_SURGE_COLORS.continuing,
    threshold: typeof d.threshold === "string" ? d.threshold : DEFAULT_VOLUME_SURGE_COLORS.threshold,
  };
}

/** The bar/tooltip color for a point under this palette: surges split by
 *  pressure side, everything else reads as continuing. */
export function volumeSurgeColorFor(point: VolumeSurgePoint | undefined, colors: VolumeSurgeColors): string {
  if (point?.strength !== "surging") return colors.continuing;
  if (point.side === "buying") return colors.buying;
  if (point.side === "selling") return colors.selling;
  return colors.surging;
}

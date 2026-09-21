import type { CandleType } from "klinecharts";
import type { Bar, CandleStyle } from "./types";

// Candle rendering styles (issue #1). The native KLineChart candle types cover
// solid / hollow / OHLC(HLC) bars / area; Heikin Ashi is a data transform
// applied before the bars reach KLineChart.

// Friendly style -> KLineChart candle.type. "heikin_ashi" renders as solid
// candles over transformed data (see HaTransformer), so it maps to solid too.
export const CANDLE_TYPE: Record<CandleStyle, CandleType> = {
  candle: "candle_solid",
  hollow: "candle_stroke",
  hollow_up: "candle_up_stroke",
  ohlc: "ohlc",
  area: "area",
  heikin_ashi: "candle_solid",
};

export function isHeikinAshi(style?: CandleStyle): boolean {
  return style === "heikin_ashi";
}

// Pure batch transform (historical load). haClose = (o+h+l+c)/4;
// haOpen = mean of the previous HA open/close; high/low clamp to include them.
export function toHeikinAshi(bars: Bar[]): Bar[] {
  const out: Bar[] = new Array(bars.length);
  let prevOpen = 0;
  let prevClose = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen = i === 0 ? (b.open + b.close) / 2 : (prevOpen + prevClose) / 2;
    out[i] = {
      time: b.time,
      open: haOpen,
      high: Math.max(b.high, haOpen, haClose),
      low: Math.min(b.low, haOpen, haClose),
      close: haClose,
      volume: b.volume,
    };
    prevOpen = haOpen;
    prevClose = haClose;
  }
  return out;
}

/**
 * Stateful Heikin Ashi transformer for the live path. `seed` primes it from the
 * loaded history; `next` converts each streamed raw bar, holding the HA open
 * steady while a bar is still forming (same timestamp) and rolling it forward
 * when a new bar begins.
 */
export class HaTransformer {
  private prevOpen = 0;
  private prevClose = 0;
  private curTime: number | null = null;
  private curOpen = 0;
  private curClose = 0;
  private seeded = false;

  seed(bars: Bar[]): void {
    if (bars.length === 0) {
      this.seeded = true;
      return;
    }
    const ha = toHeikinAshi(bars);
    const last = ha[ha.length - 1];
    // The last historical bar is treated as completed; the next live bar rolls
    // off it. Track it as "current" so a same-timestamp update stays consistent.
    const prev = ha.length > 1 ? ha[ha.length - 2] : last;
    this.prevOpen = prev.open;
    this.prevClose = prev.close;
    this.curTime = last.time;
    this.curOpen = last.open;
    this.curClose = last.close;
    this.seeded = true;
  }

  next(raw: Bar): Bar {
    if (!this.seeded) {
      // No history seeded: behave like the first bar.
      this.curOpen = (raw.open + raw.close) / 2;
    } else if (raw.time !== this.curTime) {
      // New bar: the just-finished bar's HA becomes "previous".
      this.prevOpen = this.curOpen;
      this.prevClose = this.curClose;
      this.curOpen = (this.prevOpen + this.prevClose) / 2;
    }
    const haClose = (raw.open + raw.high + raw.low + raw.close) / 4;
    this.curTime = raw.time;
    this.curClose = haClose;
    return {
      time: raw.time,
      open: this.curOpen,
      high: Math.max(raw.high, this.curOpen, haClose),
      low: Math.min(raw.low, this.curOpen, haClose),
      close: haClose,
      volume: raw.volume,
    };
  }
}

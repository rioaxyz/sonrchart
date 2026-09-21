import { describe, it, expect } from "vitest";
import { toHeikinAshi, HaTransformer, CANDLE_TYPE, isHeikinAshi } from "../src/candles";
import type { Bar } from "../src/types";

const raw: Bar[] = [
  { time: 1, open: 10, high: 12, low: 9, close: 11 },
  { time: 2, open: 11, high: 13, low: 10, close: 12 },
  { time: 3, open: 12, high: 12.5, low: 8, close: 9 },
];

describe("candle style mapping (#1)", () => {
  it("maps friendly styles to KLine candle types", () => {
    expect(CANDLE_TYPE.candle).toBe("candle_solid");
    expect(CANDLE_TYPE.hollow).toBe("candle_stroke");
    expect(CANDLE_TYPE.hollow_up).toBe("candle_up_stroke");
    expect(CANDLE_TYPE.ohlc).toBe("ohlc");
    expect(CANDLE_TYPE.area).toBe("area");
    expect(CANDLE_TYPE.heikin_ashi).toBe("candle_solid");
  });
  it("flags heikin ashi", () => {
    expect(isHeikinAshi("heikin_ashi")).toBe(true);
    expect(isHeikinAshi("hollow")).toBe(false);
    expect(isHeikinAshi(undefined)).toBe(false);
  });
});

describe("toHeikinAshi (#1)", () => {
  it("computes HA bars per the standard formulas", () => {
    const ha = toHeikinAshi(raw);
    // Bar 0: haClose=(10+12+9+11)/4=10.5; haOpen=(10+11)/2=10.5
    expect(ha[0].close).toBeCloseTo(10.5);
    expect(ha[0].open).toBeCloseTo(10.5);
    expect(ha[0].high).toBeCloseTo(12);
    expect(ha[0].low).toBeCloseTo(9);
    // Bar 1: haClose=(11+13+10+12)/4=11.5; haOpen=(prevOpen+prevClose)/2=(10.5+10.5)/2=10.5
    expect(ha[1].close).toBeCloseTo(11.5);
    expect(ha[1].open).toBeCloseTo(10.5);
    expect(ha[1].high).toBeCloseTo(13); // max(13,10.5,11.5)
    expect(ha[1].low).toBeCloseTo(10); // min(10,10.5,11.5)
    // high/low always contain the HA open & close
    for (const b of ha) {
      expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
      expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
    }
  });
  it("preserves length and timestamps", () => {
    const ha = toHeikinAshi(raw);
    expect(ha.map((b) => b.time)).toEqual([1, 2, 3]);
  });
});

describe("HaTransformer live (#1)", () => {
  it("matches the batch transform when fed bar-by-bar", () => {
    const batch = toHeikinAshi(raw);
    const t = new HaTransformer();
    t.seed(raw.slice(0, 1)); // history = first bar
    const live1 = t.next(raw[1]);
    const live2 = t.next(raw[2]);
    expect(live1.close).toBeCloseTo(batch[1].close);
    expect(live1.open).toBeCloseTo(batch[1].open);
    expect(live2.close).toBeCloseTo(batch[2].close);
    expect(live2.open).toBeCloseTo(batch[2].open);
  });
  it("holds the HA open steady while a bar keeps forming", () => {
    const t = new HaTransformer();
    t.seed(raw); // last bar is 'current'
    const forming1 = t.next({ time: 4, open: 9, high: 10, low: 8.5, close: 9.5 });
    const forming2 = t.next({ time: 4, open: 9, high: 11, low: 8.5, close: 10.5 }); // same ts, updated
    expect(forming2.open).toBeCloseTo(forming1.open); // open unchanged within the bar
    expect(forming2.close).not.toBeCloseTo(forming1.close); // close moved
  });
});

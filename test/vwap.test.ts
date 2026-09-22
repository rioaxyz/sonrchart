import { describe, expect, it } from "vitest";
import { computeVWAP, etDayIndex } from "../src/indicators";

// 10:00 and 11:00 ET on 2026-09-21 (EDT, UTC-4) — same trading day.
const t1 = Date.UTC(2026, 8, 21, 14, 0);
const t2 = Date.UTC(2026, 8, 21, 15, 0);
// 10:00 ET on 2026-09-22 — the next ET day.
const t3 = Date.UTC(2026, 8, 22, 14, 0);

describe("computeVWAP (#VWAP)", () => {
  it("accumulates volume-weighted typical price within a day", () => {
    const out = computeVWAP([
      { timestamp: t1, high: 2, low: 1, close: 1.5, volume: 10 }, // typical 1.5
      { timestamp: t2, high: 3, low: 2, close: 2.5, volume: 10 }, // typical 2.5
    ]);
    expect(out[0].vwap).toBeCloseTo(1.5, 10); // 15/10
    expect(out[1].vwap).toBeCloseTo(2.0, 10); // (15+25)/20
  });

  it("resets at the ET day boundary", () => {
    expect(etDayIndex(t2)).toBe(etDayIndex(t1));
    expect(etDayIndex(t3)).toBe(etDayIndex(t1) + 1);
    const out = computeVWAP([
      { timestamp: t1, high: 2, low: 1, close: 1.5, volume: 10 },
      { timestamp: t2, high: 3, low: 2, close: 2.5, volume: 10 }, // vwap 2.0
      { timestamp: t3, high: 5, low: 4, close: 4.5, volume: 7 }, // new day → its own typical
    ]);
    expect(out[2].vwap).toBeCloseTo(4.5, 10); // typical of the new day's first bar
  });

  it("falls back to the typical price on a zero-volume bar", () => {
    const out = computeVWAP([{ timestamp: t1, high: 2, low: 1, close: 3, volume: 0 }]);
    expect(out[0].vwap).toBeCloseTo(2, 10); // (2+1+3)/3
  });
});

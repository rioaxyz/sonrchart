import { describe, expect, it } from "vitest";
import { asSpec, mergeStyles, sessionColors, toKLine, toPeriod } from "../src/internal";
import { DEFAULT_SESSION_COLORS } from "../src/indicators";

describe("toPeriod", () => {
  it("maps every supported interval", () => {
    expect(toPeriod("10S")).toEqual({ type: "second", span: 10 });
    expect(toPeriod("30S")).toEqual({ type: "second", span: 30 });
    expect(toPeriod("1")).toEqual({ type: "minute", span: 1 });
    expect(toPeriod("5")).toEqual({ type: "minute", span: 5 });
    expect(toPeriod("15")).toEqual({ type: "minute", span: 15 });
    expect(toPeriod("30")).toEqual({ type: "minute", span: 30 });
    expect(toPeriod("60")).toEqual({ type: "hour", span: 1 });
    expect(toPeriod("D")).toEqual({ type: "day", span: 1 });
    expect(toPeriod("1D")).toEqual({ type: "day", span: 1 });
  });

  it("defaults an unknown interval to a 1-minute period", () => {
    expect(toPeriod("nonsense")).toEqual({ type: "minute", span: 1 });
  });
});

describe("toKLine", () => {
  it("renames time->timestamp and defaults missing volume to 0", () => {
    expect(toKLine({ time: 1000, open: 1, high: 2, low: 0.5, close: 1.5 })).toEqual({
      timestamp: 1000,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 0,
    });
    expect(toKLine({ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 42 }).volume).toBe(42);
  });
});

describe("asSpec", () => {
  it("wraps a bare name and passes specs through", () => {
    expect(asSpec("VOL")).toEqual({ name: "VOL" });
    const spec = { name: "MA", pane: "main" as const, calcParams: [5, 10] };
    expect(asSpec(spec)).toBe(spec);
  });
});

describe("sessionColors", () => {
  it("uses defaults for `true`", () => {
    expect(sessionColors(true)).toEqual(DEFAULT_SESSION_COLORS);
  });
  it("merges partial overrides over the defaults", () => {
    expect(sessionColors({ premarket: "#111" })).toEqual({
      premarket: "#111",
      afterhours: DEFAULT_SESSION_COLORS.afterhours,
    });
  });
});

describe("mergeStyles", () => {
  it("returns the base untouched when there is no override", () => {
    const base = { grid: { horizontal: { color: "#111" } } };
    expect(mergeStyles(base)).toBe(base);
  });
  it("lets the override win at the top level, merging within a key", () => {
    const base = { grid: { horizontal: { color: "#111" } }, candle: { bar: { upColor: "#0f0" } } };
    const over = { candle: { bar: { downColor: "#f00" } } };
    const merged = mergeStyles(base, over) as any;
    expect(merged.grid).toEqual(base.grid); // untouched key preserved
    expect(merged.candle.bar).toEqual({ downColor: "#f00" }); // one-level shallow merge
  });
});

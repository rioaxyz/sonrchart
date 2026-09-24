import { describe, it, expect } from "vitest";
import { bareTicker, buildWatermark, composeRgba, defaultWatermark, intervalLabel, mergeWatermark, normalizeWatermark } from "../src/watermark";

describe("watermark helpers", () => {
  it("strips the exchange prefix for the ticker", () => {
    expect(bareTicker("NASDAQ:AAPL")).toBe("AAPL");
    expect(bareTicker("AAPL")).toBe("AAPL");
  });

  it("maps intervals to human labels, passing through unknowns", () => {
    expect(intervalLabel("1")).toBe("1m");
    expect(intervalLabel("60")).toBe("1h");
    expect(intervalLabel("1D")).toBe("1D");
    expect(intervalLabel("weird")).toBe("weird");
  });

  it("defaults to both off with theme ink", () => {
    expect(defaultWatermark("dark")).toMatchObject({ symbol: false, interval: false, color: "#e6ebe9", opacity: 0.06 });
    expect(defaultWatermark("light").color).toBe("#1a1f29");
  });

  it("normalizes the prop: undefined/false → off, true → both on, partial → merged", () => {
    expect(normalizeWatermark(undefined, "dark").symbol).toBe(false);
    expect(normalizeWatermark(false, "dark").interval).toBe(false);
    const both = normalizeWatermark(true, "dark");
    expect(both).toMatchObject({ symbol: true, interval: true });
    const partial = normalizeWatermark({ symbol: false, opacity: 0.2 }, "dark");
    expect(partial).toMatchObject({ symbol: false, interval: true, opacity: 0.2 });
  });

  it("merges a change: boolean drives both toggles, partial overrides fields", () => {
    const cur = normalizeWatermark(true, "dark");
    expect(mergeWatermark(cur, false)).toMatchObject({ symbol: false, interval: false });
    expect(mergeWatermark(cur, { color: "#ff0000" }).color).toBe("#ff0000");
  });

  it("composes #rrggbb + opacity into rgba(), passing non-hex through", () => {
    expect(composeRgba("#e6ebe9", 0.06)).toBe("rgba(230,235,233,0.06)");
    expect(composeRgba("rgba(1,2,3,0.5)", 0.2)).toBe("rgba(1,2,3,0.5)");
  });

  it("builds watermark data honoring the symbol/interval toggles", () => {
    const opts = normalizeWatermark({ symbol: true, interval: false, color: "#e6ebe9", opacity: 0.1 }, "dark");
    const wm = buildWatermark("NASDAQ:tsla", "5", opts);
    expect(wm.title).toBe("TSLA");
    expect(wm.subtitle).toBe("");
    expect(wm.color).toBe("rgba(230,235,233,0.1)");
  });
});

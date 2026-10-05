import { describe, it, expect } from "vitest";
import type { KLineData } from "klinecharts";
import { volumeTrend, DEFAULT_VOLUME_TREND_BARS } from "../src/volumeTrend";

const bars = (...volumes: (number | undefined)[]): KLineData[] =>
  volumes.map((volume, i) => ({ timestamp: i * 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume }));

describe("volumeTrend (#79)", () => {
  it("defaults to 3 bars", () => {
    expect(DEFAULT_VOLUME_TREND_BARS).toBe(3);
  });

  it("classifies strictly rising volumes as increasing", () => {
    expect(volumeTrend(bars(10, 20, 30, 40), 3)).toBe("increasing");
  });

  it("classifies strictly falling volumes as decreasing", () => {
    expect(volumeTrend(bars(40, 30, 20, 10), 3)).toBe("decreasing");
  });

  it("classifies a mix of rising and falling as mixed", () => {
    expect(volumeTrend(bars(10, 30, 20, 40), 3)).toBe("mixed");
  });

  it("treats a flat pair as neither rising nor falling → mixed", () => {
    expect(volumeTrend(bars(10, 20, 20, 30), 3)).toBe("mixed");
    expect(volumeTrend(bars(10, 10, 10, 10), 3)).toBe("mixed");
  });

  it("only looks at the window ending at endIndex (crosshair hover)", () => {
    // Rising at the tail, but the window ending at index 3 is falling.
    const list = bars(5, 40, 30, 20, 50, 60, 70);
    expect(volumeTrend(list, 3, 2)).toBe("decreasing");
    expect(volumeTrend(list, 6, 2)).toBe("increasing");
  });

  it("returns null without bars+1 data points or when out of range", () => {
    expect(volumeTrend(bars(10, 20, 30), 2)).toBeNull(); // 3 bars loaded, needs 4
    expect(volumeTrend(bars(10, 20, 30, 40), 2, 3)).toBeNull(); // window underflows
    expect(volumeTrend(bars(10, 20), 5, 1)).toBeNull(); // endIndex past the data
    expect(volumeTrend([], -1, 3)).toBeNull(); // empty list
  });

  it("returns null when a volume in the window is missing", () => {
    expect(volumeTrend(bars(10, undefined, 30, 40), 3)).toBeNull();
  });

  it("clamps the bar count to at least 1 whole bar", () => {
    expect(volumeTrend(bars(10, 20), 1, 0)).toBe("increasing");
    expect(volumeTrend(bars(10, 20, 30), 2, 1.9)).toBe("increasing");
  });
});

function volumeTrendLatest(list: KLineData[], bars?: number) {
  return volumeTrend(list, list.length - 1, bars);
}

describe("volumeTrend — latest-bar convenience shape", () => {
  it("matches the issue's 3-bar examples at the data tail", () => {
    expect(volumeTrendLatest(bars(1, 10, 20, 30, 40))).toBe("increasing");
    expect(volumeTrendLatest(bars(99, 40, 30, 20, 10))).toBe("decreasing");
    expect(volumeTrendLatest(bars(99, 10, 40, 20, 30))).toBe("mixed");
  });
});

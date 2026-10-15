import { describe, it, expect } from "vitest";
import { sanitizeOlderBars } from "../src/scrollback";
import type { Bar } from "../src/types";

const bar = (time: number): Bar => ({ time, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 });

describe("sanitizeOlderBars (#109 seam guard)", () => {
  it("passes a clean, strictly-older, ascending page through untouched", () => {
    const page = [bar(100), bar(200), bar(300)];
    expect(sanitizeOlderBars(page, 400)).toEqual(page);
  });

  it("drops bars at or after the seam (strictly-older contract)", () => {
    const out = sanitizeOlderBars([bar(100), bar(400), bar(500)], 400);
    expect(out.map((b) => b.time)).toEqual([100]);
  });

  it("drops duplicates and non-monotonic bars instead of resorting", () => {
    const out = sanitizeOlderBars([bar(100), bar(100), bar(50), bar(200)], 400);
    expect(out.map((b) => b.time)).toEqual([100, 200]);
  });

  it("a pathological page degrades to shorter history, never corruption", () => {
    // Reverse-sorted: only the first survives — monotonic result guaranteed.
    const out = sanitizeOlderBars([bar(300), bar(200), bar(100)], 400);
    expect(out.map((b) => b.time)).toEqual([300]);
  });

  it("handles empty input", () => {
    expect(sanitizeOlderBars([], 400)).toEqual([]);
  });
});

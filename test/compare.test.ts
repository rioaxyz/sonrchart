import { describe, it, expect } from "vitest";
import { alignCompare } from "../src/compare";
import type { Bar } from "../src/types";

const bar = (time: number, close: number): Bar => ({ time, open: close, high: close, low: close, close });

describe("alignCompare (#9)", () => {
  it("ratio-scales the compare series to share the main series' start price", () => {
    const main = [bar(1, 100), bar(2, 110), bar(3, 120)];
    const cmp = [bar(1, 10), bar(2, 12), bar(3, 11)]; // 10x cheaper symbol
    const out = alignCompare(main, cmp);
    // scale = main[0].close / cmp[0].close = 100/10 = 10
    expect(out.map((p) => p.value)).toEqual([100, 120, 110]);
    expect(out.map((p) => p.time)).toEqual([1, 2, 3]);
  });

  it("emits null where the compare symbol has no bar at a timestamp", () => {
    const main = [bar(1, 100), bar(2, 110), bar(3, 120)];
    const cmp = [bar(1, 10), bar(3, 13)]; // missing t=2
    const out = alignCompare(main, cmp);
    expect(out[0].value).toBe(100);
    expect(out[1].value).toBeNull();
    expect(out[2].value).toBeCloseTo(130); // 13 * (100/10)
  });

  it("handles no overlap gracefully (scale 1, all null)", () => {
    const main = [bar(1, 100)];
    const cmp = [bar(9, 50)];
    const out = alignCompare(main, cmp);
    expect(out).toEqual([{ time: 1, value: null }]);
  });
});

import { describe, it, expect } from "vitest";
import type { KLineData } from "klinecharts";
import {
  computeVolumeSurge,
  volumeSurgeColors,
  DEFAULT_VOLUME_SURGE_BARS,
  DEFAULT_VOLUME_SURGE_MULT,
  DEFAULT_VOLUME_SURGE_COLORS,
} from "../src/volumeSurge";

const bars = (...volumes: (number | undefined)[]): KLineData[] =>
  volumes.map((volume, i) => ({ timestamp: i * 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume }));

describe("computeVolumeSurge (#VSURGE)", () => {
  it("defaults to 20 bars and a 1.5x multiple", () => {
    expect(DEFAULT_VOLUME_SURGE_BARS).toBe(20);
    expect(DEFAULT_VOLUME_SURGE_MULT).toBe(1.5);
  });

  it("marks a bar surging at >= mult x the mean of the previous N bars", () => {
    // mean of previous 3 = 100; 150 is exactly 1.5x — boundary is inclusive.
    const out = computeVolumeSurge(bars(100, 100, 100, 150), 3, 1.5);
    expect(out[3]).toEqual({ ratio: 1.5, threshold: 1.5, strength: "surging" });
  });

  it("marks a bar continuing below the multiple", () => {
    const out = computeVolumeSurge(bars(100, 100, 100, 149), 3, 1.5);
    expect(out[3].strength).toBe("continuing");
    expect(out[3].ratio).toBeCloseTo(1.49, 10);
  });

  it("excludes the bar itself from its own mean", () => {
    // If 600 were inside its own window the mean would jump and dilute the
    // ratio; excluded, the mean stays 100 and the ratio is a clean 6x.
    const out = computeVolumeSurge(bars(100, 100, 100, 600), 3, 1.5);
    expect(out[3].ratio).toBeCloseTo(6, 10);
    expect(out[3].strength).toBe("surging");
  });

  it("emits no state until N prior bars exist", () => {
    const out = computeVolumeSurge(bars(100, 100, 100, 100), 3, 1.5);
    expect(out[0]).toEqual({});
    expect(out[1]).toEqual({});
    expect(out[2]).toEqual({});
    expect(out[3].strength).toBe("continuing");
  });

  it("slides the window correctly across a long series", () => {
    // Bar 5's window is bars 2-4 (mean 200), NOT the stale early bars.
    const out = computeVolumeSurge(bars(1000, 1000, 200, 200, 200, 300), 3, 1.5);
    expect(out[5].ratio).toBeCloseTo(1.5, 10);
    expect(out[5].strength).toBe("surging");
    // Bar 4's window is bars 1-3 (mean 466.67) → 200 is continuing.
    expect(out[4].strength).toBe("continuing");
  });

  it("voids any window containing a missing volume", () => {
    const out = computeVolumeSurge(bars(100, undefined, 100, 500, 100, 100, 100, 200), 3, 1.5);
    expect(out[3]).toEqual({}); // window 0-2 has the gap
    expect(out[4]).toEqual({}); // window 1-3 has the gap
    expect(out[5].strength).toBeDefined(); // window 2-4 is clean again
    expect(out[7].ratio).toBeCloseTo(2, 10);
  });

  it("emits no state on a zero-mean window", () => {
    const out = computeVolumeSurge(bars(0, 0, 0, 500), 3, 1.5);
    expect(out[3]).toEqual({});
  });

  it("honors a custom bar count and multiple", () => {
    const out = computeVolumeSurge(bars(100, 300, 400), 2, 2);
    // window for bar 2 = bars 0-1, mean 200; 400 = 2.0x → surging at mult 2.
    expect(out[2]).toEqual({ ratio: 2, threshold: 2, strength: "surging" });
  });

  it("echoes the threshold per computed point for the reference line", () => {
    const out = computeVolumeSurge(bars(100, 100, 100, 120), 3, 1.5);
    expect(out[3].threshold).toBe(1.5);
  });
});

describe("volumeSurgeColors (extendData palette)", () => {
  it("returns the defaults when extendData is absent", () => {
    expect(volumeSurgeColors(undefined)).toEqual(DEFAULT_VOLUME_SURGE_COLORS);
    expect(volumeSurgeColors(null)).toEqual(DEFAULT_VOLUME_SURGE_COLORS);
  });

  it("overrides only the keys provided", () => {
    const c = volumeSurgeColors({ surging: "#e91e63" });
    expect(c.surging).toBe("#e91e63");
    expect(c.continuing).toBe(DEFAULT_VOLUME_SURGE_COLORS.continuing);
    expect(c.threshold).toBe(DEFAULT_VOLUME_SURGE_COLORS.threshold);
  });

  it("degrades malformed extendData to the defaults instead of throwing", () => {
    expect(volumeSurgeColors("nope")).toEqual(DEFAULT_VOLUME_SURGE_COLORS);
    expect(volumeSurgeColors({ surging: 42 })).toEqual(DEFAULT_VOLUME_SURGE_COLORS);
  });
});

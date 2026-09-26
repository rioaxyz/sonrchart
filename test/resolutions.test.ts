import { describe, expect, it } from "vitest";
import { parseResolution, resolutionMs, resolutionLabel, DEFAULT_RESOLUTIONS, UNIT_MS } from "../src/resolutions";

describe("parseResolution (#38)", () => {
  it("keeps the original interval set intact (back-compat)", () => {
    expect(parseResolution("10S")).toEqual({ type: "second", span: 10 });
    expect(parseResolution("30S")).toEqual({ type: "second", span: 30 });
    expect(parseResolution("1")).toEqual({ type: "minute", span: 1 });
    expect(parseResolution("5")).toEqual({ type: "minute", span: 5 });
    expect(parseResolution("30")).toEqual({ type: "minute", span: 30 });
    expect(parseResolution("60")).toEqual({ type: "hour", span: 1 }); // "60" is 1 hour, not 60 minutes
    expect(parseResolution("D")).toEqual({ type: "day", span: 1 });
    expect(parseResolution("1D")).toEqual({ type: "day", span: 1 });
  });

  it("parses arbitrary custom resolutions across all units", () => {
    expect(parseResolution("5S")).toEqual({ type: "second", span: 5 });
    expect(parseResolution("45")).toEqual({ type: "minute", span: 45 });
    expect(parseResolution("2H")).toEqual({ type: "hour", span: 2 });
    expect(parseResolution("240")).toEqual({ type: "minute", span: 240 });
    expect(parseResolution("3D")).toEqual({ type: "day", span: 3 });
    expect(parseResolution("W")).toEqual({ type: "week", span: 1 });
    expect(parseResolution("2W")).toEqual({ type: "week", span: 2 });
    expect(parseResolution("MO")).toEqual({ type: "month", span: 1 });
    expect(parseResolution("3MO")).toEqual({ type: "month", span: 3 });
    expect(parseResolution("Y")).toEqual({ type: "year", span: 1 });
    expect(parseResolution("2Y")).toEqual({ type: "year", span: 2 });
  });

  it("is case-insensitive and trims", () => {
    expect(parseResolution(" 2h ")).toEqual({ type: "hour", span: 2 });
    expect(parseResolution("1mo")).toEqual({ type: "month", span: 1 });
    expect(parseResolution("d")).toEqual({ type: "day", span: 1 });
  });

  it("defaults unknown tokens to 1 minute and never returns span < 1", () => {
    expect(parseResolution("nonsense")).toEqual({ type: "minute", span: 1 });
    expect(parseResolution("")).toEqual({ type: "minute", span: 1 });
    expect(parseResolution("0")).toEqual({ type: "minute", span: 1 });
    expect(parseResolution("0S")).toEqual({ type: "second", span: 1 });
  });
});

describe("resolutionMs (#38)", () => {
  it("returns the bar length in ms for each unit", () => {
    expect(resolutionMs("10S")).toBe(10_000);
    expect(resolutionMs("1")).toBe(60_000);
    expect(resolutionMs("5")).toBe(300_000);
    expect(resolutionMs("60")).toBe(3_600_000);
    expect(resolutionMs("2H")).toBe(7_200_000);
    expect(resolutionMs("D")).toBe(86_400_000);
    expect(resolutionMs("W")).toBe(UNIT_MS.week);
    expect(resolutionMs("1MO")).toBe(UNIT_MS.month);
  });
});

describe("resolutionLabel (#38)", () => {
  it("renders human words", () => {
    expect(resolutionLabel("30")).toBe("30 minute");
    expect(resolutionLabel("60")).toBe("1 hour");
    expect(resolutionLabel("2H")).toBe("2 hour");
    expect(resolutionLabel("D")).toBe("1 day");
    expect(resolutionLabel("2W")).toBe("2 week");
  });
});

describe("DEFAULT_RESOLUTIONS", () => {
  it("every default value parses to a valid period", () => {
    for (const r of DEFAULT_RESOLUTIONS) {
      const p = parseResolution(r.value);
      expect(p.span).toBeGreaterThanOrEqual(1);
      expect(UNIT_MS[p.type]).toBeGreaterThan(0);
    }
  });
});

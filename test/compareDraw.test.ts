import { describe, it, expect, vi, beforeAll } from "vitest";

// Capture the registered compare indicator so we can drive its canvas `draw`
// directly (the per-frame hot path) with a fake 2D context.
const reg = vi.hoisted(() => ({ templates: [] as any[] }));
vi.mock("klinecharts", () => ({
  registerIndicator: vi.fn((t: any) => reg.templates.push(t)),
}));

import { registerCompareIndicator, COMPARE_INDICATOR, type CompareLine } from "../src/compare";

function template(name: string) {
  return reg.templates.find((t) => t.name === name);
}

function fakeCtx() {
  return {
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    beginPath: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    lineWidth: 0,
    strokeStyle: "",
  };
}

const xAxis = { convertTimestampToPixel: vi.fn((t: number) => t) };
const yAxis = { convertToPixel: vi.fn((v: number) => v) };
const visible = (from: number, to: number) => ({ getVisibleRange: () => ({ from, to, realFrom: from, realTo: to }) });

beforeAll(() => {
  reg.templates.length = 0;
  registerCompareIndicator();
});

describe("SONR_COMPARE draw (#9)", () => {
  it("strokes one path per compare line", () => {
    const t = template(COMPARE_INDICATOR);
    const lines: CompareLine[] = [
      { color: "#f00", points: [{ time: 0, value: 1 }, { time: 1, value: 2 }, { time: 2, value: 3 }] },
      { color: "#0f0", points: [{ time: 0, value: 5 }, { time: 1, value: 4 }, { time: 2, value: 6 }] },
    ];
    const ctx = fakeCtx();
    const ret = t.draw({ ctx, chart: visible(0, 2), indicator: { extendData: lines }, xAxis, yAxis });
    expect(ret).toBe(false);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });

  it("breaks the path at null gaps (starts a new sub-line)", () => {
    const t = template(COMPARE_INDICATOR);
    const lines: CompareLine[] = [
      { color: "#f00", points: [{ time: 0, value: 1 }, { time: 1, value: null }, { time: 2, value: 3 }] },
    ];
    const ctx = fakeCtx();
    t.draw({ ctx, chart: visible(0, 2), indicator: { extendData: lines }, xAxis, yAxis });
    // Two separate points either side of the gap → two moveTo (each starts fresh).
    expect(ctx.moveTo).toHaveBeenCalledTimes(2);
    expect(ctx.lineTo).not.toHaveBeenCalled();
  });

  it("only converts the visible range (+1 bar margin)", () => {
    const t = template(COMPARE_INDICATOR);
    const points = Array.from({ length: 100 }, (_, i) => ({ time: i, value: i + 1 }));
    const ctx = fakeCtx();
    xAxis.convertTimestampToPixel.mockClear();
    // Visible bars 40..42 → with margin, indices 39..43 = 5 conversions.
    t.draw({ ctx, chart: visible(40, 42), indicator: { extendData: [{ color: "#f00", points }] }, xAxis, yAxis });
    expect(xAxis.convertTimestampToPixel).toHaveBeenCalledTimes(5);
  });

  it("no-ops with no lines", () => {
    const t = template(COMPARE_INDICATOR);
    const ctx = fakeCtx();
    expect(t.draw({ ctx, chart: visible(0, 0), indicator: { extendData: [] }, xAxis, yAxis })).toBe(false);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});

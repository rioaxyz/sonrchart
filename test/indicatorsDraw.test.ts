import { describe, it, expect, vi, beforeAll } from "vitest";

// Capture the indicator templates registered by registerSonrIndicators so we
// can invoke their canvas `draw` callbacks directly with a fake 2D context —
// the drawing logic (session run-detection, marker geometry) that jsdom can't
// exercise through a real chart.
const reg = vi.hoisted(() => ({ templates: [] as any[] }));
vi.mock("klinecharts", () => ({
  registerIndicator: vi.fn((t: any) => reg.templates.push(t)),
}));

import { registerSonrIndicators, SESSION_INDICATOR, PATTERN_INDICATOR, DEFAULT_SESSION_COLORS } from "../src/indicators";

function template(name: string) {
  return reg.templates.find((t) => t.name === name);
}

// Fake canvas 2D context recording the calls the draw code makes.
function fakeCtx() {
  const fills: string[] = [];
  const rects: number[][] = [];
  const ctx: any = {
    _fillStyleLog: fills,
    _rects: rects,
    set fillStyle(v: string) {
      fills.push(v);
    },
    get fillStyle() {
      return fills[fills.length - 1];
    },
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => rects.push([x, y, w, h])),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    textAlign: "",
    font: "",
  };
  return ctx;
}

// ET wall-clock -> UTC ms (summer/EDT UTC-4).
const etMs = (h: number, m = 0) => Date.parse(`2026-07-15T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`) + 4 * 3600_000;

const xAxis = { convertTimestampToPixel: (ts: number) => (ts / 60_000) % 1000 };
const bounding = { top: 0, height: 100, width: 100000, left: 0, right: 0, bottom: 0 };

beforeAll(() => {
  reg.templates.length = 0;
  registerSonrIndicators();
});

describe("SONR_SESSION draw (#10)", () => {
  it("registers as a price-series overlay with no figures", () => {
    const t = template(SESSION_INDICATOR);
    expect(t.series).toBe("price");
    expect(t.figures).toEqual([]);
  });

  it("fills pre-market and after-hours bands but not regular hours", () => {
    const t = template(SESSION_INDICATOR);
    const data = [
      { timestamp: etMs(5) }, // pre
      { timestamp: etMs(6) }, // pre
      { timestamp: etMs(10) }, // regular
      { timestamp: etMs(11) }, // regular
      { timestamp: etMs(17) }, // post
      { timestamp: etMs(18) }, // post
    ];
    const chart = {
      getIndicators: () => [{ extendData: DEFAULT_SESSION_COLORS }],
      getDataList: () => data,
    };
    const ctx = fakeCtx();
    const ret = t.draw({ ctx, chart, bounding, xAxis });
    expect(ret).toBe(false); // lets default rendering proceed
    // Two filled bands: pre + post (regular is untinted).
    expect(ctx._rects.length).toBe(2);
    expect(ctx._fillStyleLog).toContain(DEFAULT_SESSION_COLORS.premarket);
    expect(ctx._fillStyleLog).toContain(DEFAULT_SESSION_COLORS.afterhours);
  });

  it("no-ops on empty data", () => {
    const t = template(SESSION_INDICATOR);
    const ctx = fakeCtx();
    t.draw({ ctx, chart: { getIndicators: () => [{ extendData: DEFAULT_SESSION_COLORS }], getDataList: () => [] }, bounding, xAxis });
    expect(ctx._rects.length).toBe(0);
  });
});

describe("SONR_PATTERNS draw (#5)", () => {
  it("draws a triangle + label per marker and colors by kind", () => {
    const t = template(PATTERN_INDICATOR);
    const markers = [
      { time: etMs(10), kind: "long", label: "AT" },
      { time: etMs(11), kind: "short", label: "RW" },
    ];
    const chart = { getIndicators: () => [{ extendData: markers }] };
    const ctx = fakeCtx();
    const ret = t.draw({ ctx, chart, bounding, xAxis });
    expect(ret).toBe(false);
    expect(ctx.fill).toHaveBeenCalledTimes(2); // two triangles
    expect(ctx.fillText).toHaveBeenCalledWith("AT", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith("RW", expect.any(Number), expect.any(Number));
    expect(ctx._fillStyleLog).toContain("#35c98d"); // long = green
    expect(ctx._fillStyleLog).toContain("#ff6a76"); // short = red
  });

  it("no-ops with no markers", () => {
    const t = template(PATTERN_INDICATOR);
    const ctx = fakeCtx();
    t.draw({ ctx, chart: { getIndicators: () => [{ extendData: [] }] }, bounding, xAxis });
    expect(ctx.fill).not.toHaveBeenCalled();
  });
});

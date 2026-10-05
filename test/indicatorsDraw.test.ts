import { describe, it, expect, vi, beforeAll } from "vitest";

// Capture the indicator templates registered by registerSonrIndicators so we
// can invoke their canvas `draw` callbacks directly with a fake 2D context —
// the drawing logic (session run-detection, marker geometry) that jsdom can't
// exercise through a real chart.
const reg = vi.hoisted(() => ({ templates: [] as any[] }));
vi.mock("klinecharts", () => ({
  registerIndicator: vi.fn((t: any) => reg.templates.push(t)),
}));

import { registerSonrIndicators, SESSION_INDICATOR, PATTERN_INDICATOR, HALT_INDICATOR, DEFAULT_SESSION_COLORS, DEFAULT_HALT_BADGE, normalizeHalt } from "../src/indicators";

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
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((s: string) => ({ width: s.length * 7 })),
    textAlign: "",
    textBaseline: "",
    font: "",
  };
  return ctx;
}

// ET wall-clock -> UTC ms (summer/EDT UTC-4).
const etMs = (h: number, m = 0) => Date.parse(`2026-07-15T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`) + 4 * 3600_000;

const xAxis = { convertTimestampToPixel: (ts: number) => (ts / 60_000) % 1000 };
const bounding = { top: 0, height: 100, width: 100000, left: 0, right: 0, bottom: 0 };
const visibleAll = (n: number) => ({ from: 0, to: n - 1, realFrom: 0, realTo: n - 1 });

beforeAll(() => {
  reg.templates.length = 0;
  registerSonrIndicators();
});

describe("SONR_SESSION calc + draw (#10)", () => {
  it("registers as a price-series overlay with no figures", () => {
    const t = template(SESSION_INDICATOR);
    expect(t.series).toBe("price");
    expect(t.figures).toEqual([]);
  });

  it("calc classifies each bar's session (out of the per-frame draw path)", () => {
    const t = template(SESSION_INDICATOR);
    const data = [{ timestamp: etMs(5) }, { timestamp: etMs(10) }, { timestamp: etMs(17) }];
    const result = t.calc(data);
    // pre=1, regular=0, post=2
    expect(result.map((r: any) => r.s)).toEqual([1, 0, 2]);
  });

  it("draw reads the precomputed sessions and fills pre + post bands only", () => {
    const t = template(SESSION_INDICATOR);
    const data = [
      { timestamp: etMs(5) }, { timestamp: etMs(6) }, // pre
      { timestamp: etMs(10) }, { timestamp: etMs(11) }, // regular
      { timestamp: etMs(17) }, { timestamp: etMs(18) }, // post
    ];
    const result = t.calc(data);
    const chart = { getDataList: () => data, getVisibleRange: () => visibleAll(data.length) };
    const ctx = fakeCtx();
    const ret = t.draw({ ctx, chart, indicator: { extendData: DEFAULT_SESSION_COLORS, result }, bounding, xAxis });
    expect(ret).toBe(false);
    expect(ctx._rects.length).toBe(2); // pre + post
    expect(ctx._fillStyleLog).toContain(DEFAULT_SESSION_COLORS.premarket);
    expect(ctx._fillStyleLog).toContain(DEFAULT_SESSION_COLORS.afterhours);
  });

  it("only paints the visible range (plus a 1-bar margin)", () => {
    const t = template(SESSION_INDICATOR);
    const data = [
      { timestamp: etMs(5) }, // pre  (hidden, > 1 bar before the visible range)
      { timestamp: etMs(6) }, // pre  (hidden)
      { timestamp: etMs(10) }, // regular (the 1-bar margin bar)
      { timestamp: etMs(17) }, // post (visible)
      { timestamp: etMs(18) }, // post (visible)
    ];
    const result = t.calc(data);
    // Visible = indices 3..4; the -1 margin reaches index 2 (regular), never the pre bars.
    const chart = { getDataList: () => data, getVisibleRange: () => ({ from: 3, to: 4, realFrom: 3, realTo: 4 }) };
    const ctx = fakeCtx();
    t.draw({ ctx, chart, indicator: { extendData: DEFAULT_SESSION_COLORS, result }, bounding, xAxis });
    expect(ctx._fillStyleLog).not.toContain(DEFAULT_SESSION_COLORS.premarket);
    expect(ctx._fillStyleLog).toContain(DEFAULT_SESSION_COLORS.afterhours);
  });

  it("no-ops on empty data", () => {
    const t = template(SESSION_INDICATOR);
    const ctx = fakeCtx();
    t.draw({ ctx, chart: { getDataList: () => [], getVisibleRange: () => visibleAll(0) }, indicator: { extendData: DEFAULT_SESSION_COLORS, result: [] }, bounding, xAxis });
    expect(ctx._rects.length).toBe(0);
  });
});

describe("SONR_PATTERNS draw (#5)", () => {
  it("draws a triangle + label per marker from extendData, colored by kind", () => {
    const t = template(PATTERN_INDICATOR);
    const markers = [
      { time: etMs(10), kind: "long", label: "AT" },
      { time: etMs(11), kind: "short", label: "RW" },
    ];
    const ctx = fakeCtx();
    const ret = t.draw({ ctx, indicator: { extendData: markers }, bounding, xAxis });
    expect(ret).toBe(false);
    expect(ctx.fill).toHaveBeenCalledTimes(2);
    expect(ctx.fillText).toHaveBeenCalledWith("AT", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith("RW", expect.any(Number), expect.any(Number));
    expect(ctx._fillStyleLog).toContain("#35c98d");
    expect(ctx._fillStyleLog).toContain("#ff6a76");
  });

  it("no-ops with no markers", () => {
    const t = template(PATTERN_INDICATOR);
    const ctx = fakeCtx();
    t.draw({ ctx, indicator: { extendData: [] }, bounding, xAxis });
    expect(ctx.fill).not.toHaveBeenCalled();
  });
});

describe("SONR_HALT draw (#78)", () => {
  const haltBounding = { top: 0, height: 400, width: 800, left: 0, right: 0, bottom: 0 };

  it("registers as a price-series overlay with no figures", () => {
    const t = template(HALT_INDICATOR);
    expect(t.series).toBe("price");
    expect(t.figures).toEqual([]);
  });

  it("draws a pill at the pane's top-right with the label centered in it", () => {
    const t = template(HALT_INDICATOR);
    const ctx = fakeCtx();
    const ret = t.draw({ ctx, indicator: { extendData: DEFAULT_HALT_BADGE }, bounding: haltBounding });
    expect(ret).toBe(false);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect(ctx.arcTo).toHaveBeenCalledTimes(4); // rounded pill corners
    expect(ctx._fillStyleLog).toContain(DEFAULT_HALT_BADGE.color);
    expect(ctx._fillStyleLog).toContain(DEFAULT_HALT_BADGE.textColor);
    // Label text: "Halt" = 4 chars * 7px + 2*8 padding = 44px pill, inset 8px
    // from the right edge → centered at 800 - 8 - 44/2 = 770.
    expect(ctx.fillText).toHaveBeenCalledWith("Halt", 770, expect.any(Number));
    // Pinned to the top of the pane (8px inset + half the 20px pill height).
    const y = ctx.fillText.mock.calls[0][2];
    expect(y).toBeGreaterThan(8);
    expect(y).toBeLessThan(28 + 1);
  });

  it("honors custom label and colors", () => {
    const t = template(HALT_INDICATOR);
    const ctx = fakeCtx();
    t.draw({ ctx, indicator: { extendData: { label: "Halted (LUDP)", color: "#f00", textColor: "#000" } }, bounding: haltBounding });
    expect(ctx.fillText).toHaveBeenCalledWith("Halted (LUDP)", expect.any(Number), expect.any(Number));
    expect(ctx._fillStyleLog).toContain("#f00");
    expect(ctx._fillStyleLog).toContain("#000");
  });

  it("no-ops without config", () => {
    const t = template(HALT_INDICATOR);
    const ctx = fakeCtx();
    t.draw({ ctx, indicator: {}, bounding: haltBounding });
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});

describe("normalizeHalt (#78)", () => {
  it("maps false/undefined to null (badge off)", () => {
    expect(normalizeHalt(false)).toBeNull();
    expect(normalizeHalt(undefined)).toBeNull();
  });

  it("maps true to the default blue badge", () => {
    expect(normalizeHalt(true)).toEqual(DEFAULT_HALT_BADGE);
  });

  it("fills partial overrides with defaults", () => {
    expect(normalizeHalt({ label: "Volatility halt" })).toEqual({ ...DEFAULT_HALT_BADGE, label: "Volatility halt" });
    expect(normalizeHalt({ color: "#e0a33c", textColor: "#111" })).toEqual({ label: "Halt", color: "#e0a33c", textColor: "#111" });
  });
});

import { describe, it, expect, vi } from "vitest";

// Capture every overlay registered by registerShapeOverlays so we can assert
// on each template (name, totalStep) and drive its createPointFigures directly.
const reg = vi.hoisted(() => ({ templates: [] as any[] }));
vi.mock("klinecharts", () => ({
  registerOverlay: vi.fn((t: any) => reg.templates.push(t)),
}));

import {
  registerShapeOverlays,
  SHAPE_OVERLAYS,
  SHAPE_RECTANGLE,
  SHAPE_ELLIPSE,
  SHAPE_TRIANGLE,
  SHAPE_PRICE_RANGE,
  SHAPE_RISK_REWARD,
  priceRangeLabel,
  riskRewardStats,
  rectangleFigures,
  priceRangeFigures,
} from "../src/shapes";
import { DEFAULT_DRAWING_TOOLS } from "../src/drawings";

registerShapeOverlays();
const template = (name: string) => reg.templates.find((t) => t.name === name);

// Minimal params factory: screen coordinates + anchored price points.
function params(coords: Array<{ x: number; y: number }>, values: number[] = []) {
  return { coordinates: coords, overlay: { points: values.map((value) => ({ value })) } } as any;
}

describe("shapes (#34)", () => {
  it("registers all five shape/measurement overlays", () => {
    for (const name of SHAPE_OVERLAYS) expect(template(name)).toBeDefined();
    expect(SHAPE_OVERLAYS).toHaveLength(5);
  });

  it("is idempotent — a second call registers nothing new", () => {
    const before = reg.templates.length;
    registerShapeOverlays();
    expect(reg.templates.length).toBe(before);
  });

  it("uses points+1 totalStep (2-click shapes = 3, 3-click = 4)", () => {
    expect(template(SHAPE_RECTANGLE).totalStep).toBe(3);
    expect(template(SHAPE_ELLIPSE).totalStep).toBe(3);
    expect(template(SHAPE_PRICE_RANGE).totalStep).toBe(3);
    expect(template(SHAPE_TRIANGLE).totalStep).toBe(4);
    expect(template(SHAPE_RISK_REWARD).totalStep).toBe(4);
  });

  it("all tools appear in DEFAULT_DRAWING_TOOLS", () => {
    const tools = DEFAULT_DRAWING_TOOLS.map((d) => d.tool);
    for (const name of SHAPE_OVERLAYS) expect(tools).toContain(name);
  });

  it("rectangle builds a normalized stroke_fill rect box", () => {
    // Points given bottom-right → top-left; attrs must normalize to top-left.
    const figs = rectangleFigures(params([{ x: 30, y: 40 }, { x: 10, y: 15 }]));
    expect(figs).toHaveLength(1);
    expect(figs[0].type).toBe("rect");
    expect(figs[0].attrs).toEqual({ x: 10, y: 15, width: 20, height: 25 });
    expect((figs[0].styles as any).style).toBe("stroke_fill");
  });

  it("rectangle returns nothing before the second point is placed", () => {
    expect(rectangleFigures(params([{ x: 1, y: 1 }]))).toEqual([]);
  });

  it("price range emits a box and a delta/% label figure", () => {
    const figs = priceRangeFigures(params([{ x: 0, y: 100 }, { x: 50, y: 40 }], [100, 110]));
    expect(figs.map((f) => f.type)).toEqual(["rect", "text"]);
    const label = figs[1].attrs as { text: string };
    expect(label.text).toBe("+10.00 (+10.00%)");
  });

  it("priceRangeLabel formats signed delta and percent", () => {
    expect(priceRangeLabel(100, 110)).toBe("+10.00 (+10.00%)");
    expect(priceRangeLabel(100, 90)).toBe("-10.00 (-10.00%)");
    expect(priceRangeLabel(0, 5)).toBe("+5.00 (+0.00%)"); // guards divide-by-zero
  });

  it("riskRewardStats computes an R multiple, NaN-safe", () => {
    expect(riskRewardStats(100, 95, 110)).toEqual({ risk: 5, reward: 10, rr: 2 });
    expect(riskRewardStats(100, 100, 110).rr).toBe(0); // zero risk → 0, not Infinity
  });
});

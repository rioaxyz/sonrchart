import { describe, it, expect, vi } from "vitest";

const reg = vi.hoisted(() => ({ templates: [] as any[] }));
vi.mock("klinecharts", () => ({ registerOverlay: vi.fn((t: any) => reg.templates.push(t)) }));

import { registerTradeReview, tradeBoxFigures, SONR_TRADE_BOX } from "../src/tradeReview";

registerTradeReview();
const template = () => reg.templates.find((t) => t.name === SONR_TRADE_BOX);

function params(coords: Array<{ x: number; y: number }>, extendData?: unknown) {
  return { coordinates: coords, overlay: { extendData } } as any;
}

describe("trade-box overlay (#157 review polish)", () => {
  it("registers the overlay without default point handles, idempotently", () => {
    expect(template()).toBeDefined();
    expect(template().needDefaultPointFigure).toBe(false);
    const before = reg.templates.length;
    registerTradeReview();
    expect(reg.templates.length).toBe(before);
  });

  it("needs two points", () => {
    expect(tradeBoxFigures(params([{ x: 1, y: 1 }]))).toEqual([]);
  });

  it("draws a green box + entry line + two dots + label for a win", () => {
    const figs = tradeBoxFigures(params([{ x: 10, y: 100 }, { x: 60, y: 40 }], { up: true, label: "+1.34R" }));
    const rect = figs.find((f) => f.type === "rect")!;
    expect(rect.attrs).toEqual({ x: 10, y: 40, width: 50, height: 60 }); // min x/y, abs w/h
    expect(rect.styles.borderColor).toBe("#26a69a"); // green
    expect(figs.filter((f) => f.type === "circle")).toHaveLength(2); // entry + exit dots
    expect(figs.some((f) => f.type === "line")).toBe(true); // entry reference line
    const label = figs.find((f) => f.type === "text")!;
    expect(label.attrs.text).toBe("+1.34R");
    expect(label.styles.backgroundColor).toBe("#26a69a");
  });

  it("uses red for a loss", () => {
    const figs = tradeBoxFigures(params([{ x: 10, y: 40 }, { x: 60, y: 100 }], { up: false, label: "-$80" }));
    expect(figs.find((f) => f.type === "rect")!.styles.borderColor).toBe("#ef5350");
  });

  it("omits the entry line when entryLine is false and the label when absent", () => {
    const figs = tradeBoxFigures(params([{ x: 0, y: 0 }, { x: 10, y: 10 }], { up: true, entryLine: false }));
    expect(figs.some((f) => f.type === "line")).toBe(false);
    expect(figs.some((f) => f.type === "text")).toBe(false);
  });

  it("defaults to a green (up) box when no extendData is given", () => {
    const figs = tradeBoxFigures(params([{ x: 0, y: 0 }, { x: 10, y: 10 }]));
    expect(figs.find((f) => f.type === "rect")!.styles.borderColor).toBe("#26a69a");
  });
});

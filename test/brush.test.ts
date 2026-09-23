import { describe, it, expect } from "vitest";
import { smoothStroke, brushStyle, isBrushTool } from "../src/brush";

describe("brush (#34)", () => {
  it("flags the freehand tools", () => {
    expect(isBrushTool("brush")).toBe(true);
    expect(isBrushTool("highlighter")).toBe(true);
    expect(isBrushTool("segment")).toBe(false);
  });

  it("gives brush a thin ink stroke and highlighter a thick translucent one", () => {
    expect(brushStyle("brush", "dark")).toEqual({ color: "#e6ebe9", size: 2 });
    expect(brushStyle("brush", "light").color).toBe("#1a1f29");
    const hl = brushStyle("highlighter", "dark");
    expect(hl.size).toBe(14);
    expect(hl.color).toContain("rgba");
  });

  it("smoothStroke densifies the path and keeps the endpoints", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 30, y: 10 },
      { x: 50, y: 40 },
    ];
    const out = smoothStroke(pts);
    expect(out.length).toBeGreaterThan(pts.length); // spline-resampled
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 50, y: 40 });
  });

  it("leaves a too-short stroke unchanged", () => {
    const pts = [{ x: 1, y: 1 }, { x: 2, y: 2 }];
    expect(smoothStroke(pts)).toEqual(pts);
  });
});

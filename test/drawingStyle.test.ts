import { describe, it, expect } from "vitest";
import { DEFAULT_DRAWING_STYLE, toOverlayStyle, withAlpha } from "../src/drawingStyle";

describe("withAlpha (#103)", () => {
  it("converts #rrggbb to rgba at the given alpha", () => {
    expect(withAlpha("#ff0000", 0.12)).toBe("rgba(255,0,0,0.12)");
    expect(withAlpha("#1677ff", 1)).toBe("rgba(22,119,255,1)");
  });

  it("passes non-hex colors through untouched", () => {
    expect(withAlpha("rgba(1,2,3,0.5)", 0.12)).toBe("rgba(1,2,3,0.5)");
    expect(withAlpha("red", 0.5)).toBe("red");
  });
});

describe("toOverlayStyle (#103 pen → OverlayStyle)", () => {
  it("maps the pen onto lines, shapes (stroke + tinted fill), and arcs", () => {
    const o = toOverlayStyle({ color: "#ff0000", lineStyle: "dashed", size: 3 });
    expect(o.line).toEqual({ color: "#ff0000", size: 3, style: "dashed" });
    expect(o.arc).toEqual({ color: "#ff0000", size: 3, style: "dashed" });
    for (const fam of ["polygon", "rect", "circle"] as const) {
      expect(o[fam]).toMatchObject({ borderColor: "#ff0000", borderSize: 3, borderStyle: "dashed" });
      expect((o[fam] as { color: string }).color).toBe("rgba(255,0,0,0.12)"); // faint fill of the stroke
    }
  });

  it("solid stays solid", () => {
    const o = toOverlayStyle({ ...DEFAULT_DRAWING_STYLE });
    expect(o.line).toMatchObject({ style: "solid", size: 1, color: "#1677ff" });
  });
});

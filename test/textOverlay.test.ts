import { describe, it, expect } from "vitest";
import { textFigures, TEXT_OVERLAY } from "../src/textOverlay";
import { DEFAULT_DRAWING_TOOLS } from "../src/drawings";

// The builder takes KLineChart's createPointFigures params; we only need
// coordinates + overlay.extendData for the text figure.
function params(coords: Array<{ x: number; y: number }>, ext?: Record<string, unknown>) {
  return { coordinates: coords, overlay: { extendData: ext } } as never;
}

describe("text overlay", () => {
  it("is registered as a toolbar tool", () => {
    expect(DEFAULT_DRAWING_TOOLS.some((t) => t.tool === "text")).toBe(true);
    expect(TEXT_OVERLAY).toBe("text");
  });

  it("renders the typed label at the anchor coordinate", () => {
    const figs = textFigures(params([{ x: 40, y: 12 }], { text: "Test" }));
    expect(figs).toHaveLength(1);
    expect(figs[0].type).toBe("text");
    expect(figs[0].attrs).toMatchObject({ x: 40, y: 12, text: "Test" });
  });

  it("applies the label's color + size from extendData", () => {
    const figs = textFigures(params([{ x: 0, y: 0 }], { text: "Hi", color: "#ff0000", size: 20 })) as any;
    expect(figs[0].styles).toMatchObject({ color: "#ff0000", size: 20, borderColor: "#ff0000" });
  });

  it("falls back to a placeholder while the label is empty", () => {
    expect((textFigures(params([{ x: 0, y: 0 }], { text: "" })) as any)[0].attrs.text).toBe("Text");
    expect((textFigures(params([{ x: 0, y: 0 }])) as any)[0].attrs.text).toBe("Text");
  });

  it("draws nothing before an anchor is placed", () => {
    expect(textFigures(params([]))).toEqual([]);
  });
});

import { describe, it, expect, vi } from "vitest";

// Capture every overlay registered so we can assert on each template and drive
// its createPointFigures directly (mirrors shapes.test.ts).
const reg = vi.hoisted(() => ({ templates: [] as any[] }));
vi.mock("klinecharts", () => ({
  registerOverlay: vi.fn((t: any) => reg.templates.push(t)),
}));

import {
  registerExtendedDrawings,
  EXTENDED_OVERLAYS,
  EXT_HORIZONTAL_RAY,
  EXT_CROSS_LINE,
  EXT_ARROW,
  EXT_FIB_EXTENSION,
  EXT_FIB_TIME_ZONE,
  EXT_DATE_RANGE,
  EXT_DATE_PRICE_RANGE,
  FIB_EXTENSION_LEVELS,
  fibSequence,
  arrowHeadPoints,
  humanDuration,
  dateRangeLabel,
  horizontalRayFigures,
  crossLineFigures,
  arrowFigures,
  fibExtensionFigures,
  fibTimeZoneFigures,
  dateRangeFigures,
} from "../src/drawingsExtended";
import { EXTENDED_DRAWING_TOOLS } from "../src/drawings";

registerExtendedDrawings();
const template = (name: string) => reg.templates.find((t) => t.name === name);

// Params factory: screen coordinates + anchored points (value/dataIndex/ts) + bounding.
function params(
  coords: Array<{ x: number; y: number }>,
  points: Array<{ value?: number; dataIndex?: number; timestamp?: number }> = [],
  bounding = { width: 1000, height: 500, left: 0, right: 0, top: 0, bottom: 0 },
) {
  return { coordinates: coords, overlay: { points }, bounding } as any;
}

describe("extended-drawing registration (#34)", () => {
  it("registers all seven overlays with points+1 totalStep", () => {
    for (const name of EXTENDED_OVERLAYS) expect(template(name)).toBeDefined();
    expect(EXTENDED_OVERLAYS).toHaveLength(7);
    expect(template(EXT_CROSS_LINE).totalStep).toBe(2); // 1 point + 1
    expect(template(EXT_ARROW).totalStep).toBe(3); // 2 points + 1
    expect(template(EXT_FIB_EXTENSION).totalStep).toBe(4); // 3 points + 1
  });

  it("is idempotent — a second call registers nothing new", () => {
    const before = reg.templates.length;
    registerExtendedDrawings();
    expect(reg.templates.length).toBe(before);
  });

  it("every extended tool has an object-tree label", () => {
    const tools = EXTENDED_DRAWING_TOOLS.map((t) => t.tool).sort();
    expect(tools).toEqual([...EXTENDED_OVERLAYS].sort());
    for (const t of EXTENDED_DRAWING_TOOLS) expect(t.label.length).toBeGreaterThan(0);
  });
});

describe("pure helpers", () => {
  it("fibSequence produces 1,2,3,5,8,…", () => {
    expect(fibSequence(6)).toEqual([1, 2, 3, 5, 8, 13]);
    expect(fibSequence(0)).toEqual([]);
    expect(fibSequence(-2)).toEqual([]);
  });

  it("arrowHeadPoints returns [barb, tip, barb] with the tip at the segment end", () => {
    const pts = arrowHeadPoints(0, 0, 100, 0, 10, Math.PI / 6);
    expect(pts).toHaveLength(3);
    expect(pts[1]).toEqual({ x: 100, y: 0 }); // tip
    // Barbs are swept back (x < tip) and symmetric about the axis.
    expect(pts[0].x).toBeLessThan(100);
    expect(pts[2].x).toBeLessThan(100);
    expect(pts[0].y).toBeCloseTo(-pts[2].y, 6);
  });

  it("humanDuration coarse-grains to the largest two units", () => {
    expect(humanDuration(45_000)).toBe("45s");
    expect(humanDuration(3_660_000)).toBe("1h 1m");
    expect(humanDuration(90_000)).toBe("1m 30s"); // minutes + seconds (two largest units)
    expect(humanDuration(3 * 3_600_000 + 20 * 60_000 + 5_000)).toBe("3h 20m"); // seconds dropped when hours present
    expect(humanDuration(0)).toBe("0s");
    expect(humanDuration(2 * 86_400_000 + 3 * 3_600_000)).toBe("2d 3h");
  });

  it("dateRangeLabel pluralizes bars and appends the duration", () => {
    expect(dateRangeLabel(1, 60_000)).toBe("1 bar · 1m");
    expect(dateRangeLabel(12, 3_600_000)).toBe("12 bars · 1h");
    expect(dateRangeLabel(-5, -300_000)).toBe("5 bars · 5m"); // magnitudes
  });
});

describe("figure builders", () => {
  it("horizontalRay locks to the first point's y and extends toward the 2nd point", () => {
    const right = horizontalRayFigures(params([{ x: 100, y: 50 }, { x: 400, y: 200 }]));
    expect(right[0].attrs.coordinates).toEqual([{ x: 100, y: 50 }, { x: 1000, y: 50 }]); // to right edge
    const left = horizontalRayFigures(params([{ x: 400, y: 50 }, { x: 100, y: 200 }]));
    expect(left[0].attrs.coordinates).toEqual([{ x: 400, y: 50 }, { x: 0, y: 50 }]); // to left edge
    expect(horizontalRayFigures(params([]))).toEqual([]);
  });

  it("crossLine spans the full pane width and height through the point", () => {
    const figs = crossLineFigures(params([{ x: 300, y: 120 }]));
    expect(figs).toHaveLength(2);
    expect(figs[0].attrs.coordinates).toEqual([{ x: 0, y: 120 }, { x: 1000, y: 120 }]);
    expect(figs[1].attrs.coordinates).toEqual([{ x: 300, y: 0 }, { x: 300, y: 500 }]);
  });

  it("arrow draws a segment plus a 3-point arrowhead at the end", () => {
    const figs = arrowFigures(params([{ x: 0, y: 0 }, { x: 100, y: 0 }]));
    expect(figs[0].type).toBe("line");
    expect(figs[1].type).toBe("polygon");
    expect(figs[1].attrs.coordinates).toHaveLength(3);
    expect(arrowFigures(params([{ x: 0, y: 0 }]))).toEqual([]); // needs 2 points
  });

  it("fibExtension draws a line+label per level, projecting AB from C in pixel space", () => {
    // A=(100 @ y0), B=(110 @ y-100) → 10 price = -100px. C=(105 @ y-50).
    const figs = fibExtensionFigures(
      params(
        [{ x: 0, y: 0 }, { x: 0, y: -100 }, { x: 200, y: -50 }],
        [{ value: 100 }, { value: 110 }, { value: 105 }],
      ),
    );
    expect(figs).toHaveLength(FIB_EXTENSION_LEVELS.length * 2); // line + text each
    // Level 1.0: y = C.y + 1*(yB-yA) = -50 + (-100) = -150; price = 105 + 1*10 = 115.
    const oneIdx = FIB_EXTENSION_LEVELS.indexOf(1);
    const line = figs[oneIdx * 2];
    const text = figs[oneIdx * 2 + 1];
    expect(line.attrs.coordinates[0].y).toBe(-150);
    expect(line.attrs.coordinates[1].x).toBe(1000); // to right edge
    expect(text.attrs.text).toContain("115.00");
  });

  it("fibTimeZone places vertical lines at Fibonacci multiples within the pane", () => {
    const figs = fibTimeZoneFigures(params([{ x: 0, y: 0 }, { x: 100, y: 0 }])); // unit=100
    // multiples 1,2,3,5,8 land at 100..800 (<=1000); 13→1300 clipped out.
    expect(figs).toHaveLength(5);
    expect(figs.map((f) => f.attrs.coordinates[0].x)).toEqual([100, 200, 300, 500, 800]);
    expect(fibTimeZoneFigures(params([{ x: 5, y: 0 }, { x: 5, y: 0 }]))).toEqual([]); // zero unit
  });

  it("dateRange labels bar count + duration from anchored points", () => {
    const figs = dateRangeFigures(
      params(
        [{ x: 100, y: 100 }, { x: 300, y: 200 }],
        [{ dataIndex: 4, timestamp: 0 }, { dataIndex: 16, timestamp: 3_600_000 }],
      ),
    );
    expect(figs[0].type).toBe("rect");
    expect(figs[1].attrs.text).toBe("12 bars · 1h");
  });
});

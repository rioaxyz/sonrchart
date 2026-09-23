import { registerOverlay } from "klinecharts";
import type { Theme } from "./types";

// Freehand brush / highlighter (issue #34 — the "brush, highlighter" shapes).
// KLineChart has no native freehand tool, but v10 supports `drawingMode:
// "continuous"` — an overlay that captures a mouse-down → move → up stroke as a
// series of points. We register one such overlay and draw a smooth polyline
// through the captured points; the stroke's colour/width come from extendData,
// so brush and highlighter share the renderer with different styles. Because it's
// a normal overlay (created in the user-drawing group), it pans/zooms with the
// chart and plugs into undo/redo, clear, and export/import for free.

export const BRUSH_OVERLAY = "sonrBrush";

export interface BrushStyle {
  color: string;
  size: number;
}

/** The two brush tools, keyed to the drawing-toolbar tool ids. */
export type BrushTool = "brush" | "highlighter";

export function isBrushTool(tool: string): tool is BrushTool {
  return tool === "brush" || tool === "highlighter";
}

/** Preset style for a brush tool in the current theme. Brush is a thin solid
 *  stroke in the foreground ink; highlighter is a thick, translucent marker. */
export function brushStyle(tool: BrushTool, theme: Theme): BrushStyle {
  if (tool === "highlighter") return { color: "rgba(245,214,66,0.35)", size: 14 };
  return { color: theme === "dark" ? "#e6ebe9" : "#1a1f29", size: 2 };
}

let _registered = false;

export function registerBrushOverlay(): void {
  if (_registered) return;
  _registered = true;
  registerOverlay({
    name: BRUSH_OVERLAY,
    // Continuous freehand: the stroke completes on mouse-up.
    drawingMode: "continuous",
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, overlay }) => {
      if (!coordinates || coordinates.length < 2) return [];
      const ext = (overlay.extendData as BrushStyle | undefined) ?? { color: "#888888", size: 2 };
      return [
        {
          type: "line",
          attrs: { coordinates },
          styles: { style: "solid", smooth: true, color: ext.color, size: ext.size },
        },
      ];
    },
  });
}

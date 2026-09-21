import { type RefObject } from "react";
import type { SonrChartHandle } from "./SonrChart";
import { DEFAULT_DRAWING_TOOLS, type DrawingToolOption } from "./drawings";

// Drop-in drawing-tool palette (issue #3). Each button starts interactive
// drawing of that tool through the chart ref; a Clear button removes all
// user drawings. Compose your own UI on the same ref API if you prefer.
export function DrawingToolbar({
  chartRef,
  tools = DEFAULT_DRAWING_TOOLS,
  className,
  showClear = true,
}: {
  chartRef: RefObject<SonrChartHandle>;
  tools?: DrawingToolOption[];
  className?: string;
  showClear?: boolean;
}) {
  return (
    <div className={className ?? "sonr-drawing-toolbar"} role="group" aria-label="Drawing tools">
      {tools.map((t) => (
        <button
          key={t.tool}
          type="button"
          className="sonr-draw-btn"
          title={t.label}
          onClick={() => chartRef.current?.startDrawing(t.tool)}
        >
          {t.label}
        </button>
      ))}
      {showClear && (
        <button
          type="button"
          className="sonr-draw-btn sonr-draw-clear"
          title="Remove all drawings"
          onClick={() => chartRef.current?.clearDrawings()}
        >
          Clear
        </button>
      )}
    </div>
  );
}

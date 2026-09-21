import { type ReactNode, type RefObject } from "react";
import type { SonrChartHandle } from "./SonrChart";
import type { Interval } from "./types";
import { IndicatorMenu, type IndicatorOption } from "./IndicatorMenu";
import { DrawingToolbar } from "./DrawingToolbar";
import { type DrawingToolOption } from "./drawings";
import { downloadSnapshot } from "./snapshot";

// A composable chart chrome kit (issue #17): interval buttons, the indicator
// menu, the drawing palette, and a snapshot button — all driving one chart ref.
// Everything is optional; hosts can also use the pieces individually or build
// their own chrome. Legend/tooltip is KLineChart's built-in; settings dialogs
// stay host-owned by design (this library is a chart, not an app shell).
export function ChartToolbar({
  chartRef,
  intervals,
  interval,
  onIntervalChange,
  indicatorOptions,
  drawingTools,
  showDrawing = true,
  showSnapshot = true,
  snapshotName = "chart.png",
  className,
  children,
}: {
  chartRef: RefObject<SonrChartHandle>;
  intervals?: Interval[];
  interval?: Interval;
  onIntervalChange?: (interval: Interval) => void;
  indicatorOptions?: IndicatorOption[];
  drawingTools?: DrawingToolOption[];
  showDrawing?: boolean;
  showSnapshot?: boolean;
  snapshotName?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={className ?? "sonr-chart-toolbar"} role="toolbar" aria-label="Chart toolbar">
      {intervals && intervals.length > 0 && (
        <div className="sonr-interval-group" role="group" aria-label="Interval">
          {intervals.map((iv) => (
            <button
              key={iv}
              type="button"
              className={`sonr-iv-btn${interval === iv ? " on" : ""}`}
              aria-pressed={interval === iv}
              onClick={() => onIntervalChange?.(iv)}
            >
              {iv}
            </button>
          ))}
        </div>
      )}
      <IndicatorMenu chartRef={chartRef} options={indicatorOptions} />
      {showDrawing && <DrawingToolbar chartRef={chartRef} tools={drawingTools} />}
      {children}
      {showSnapshot && (
        <button
          type="button"
          className="sonr-snapshot-btn"
          title="Save a snapshot"
          onClick={() => downloadSnapshot(chartRef.current, snapshotName)}
        >
          Snapshot
        </button>
      )}
    </div>
  );
}

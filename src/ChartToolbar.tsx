import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { SonrChartHandle } from "./SonrChart";
import type { Interval } from "./types";
import type { CandleStyle, PriceScale } from "./types";
import { IndicatorMenu, type IndicatorOption } from "./IndicatorMenu";
import { CandleMenu, type CandleStyleOption } from "./CandleMenu";
import { PriceScaleMenu } from "./PriceScaleMenu";
import { DrawingToolbar } from "./DrawingToolbar";
import { type DrawingToolOption } from "./drawings";
import { downloadSnapshot } from "./snapshot";
import { ensureDefaultStyles } from "./defaultStyles";
import { CameraIcon, GearIcon } from "./icons";
import { SettingsModal } from "./SettingsModal";

// A composable chart chrome kit (issue #17): interval buttons, the indicator
// menu, the drawing palette, and a snapshot button — all driving one chart ref.
// Everything is optional; hosts can also use the pieces individually or build
// their own chrome. Legend/tooltip is KLineChart's built-in; settings dialogs
// stay host-owned by design (this library is a chart, not an app shell).
//
// When the toolbar is wider than the tile it scrolls horizontally; edge chevrons
// appear on hover to show (and drive) the scrollable direction, TradingView-style.
export function ChartToolbar({
  chartRef,
  intervals,
  interval,
  onIntervalChange,
  candleStyle,
  onCandleStyleChange,
  candleStyles,
  priceScale,
  onPriceScaleChange,
  sessions,
  onSessionsChange,
  watermark,
  onWatermarkChange,
  indicatorOptions,
  drawingTools,
  showDrawing = true,
  showSnapshot = true,
  showSettings = true,
  snapshotName = "chart.png",
  className,
  children,
}: {
  chartRef: RefObject<SonrChartHandle>;
  intervals?: Interval[];
  interval?: Interval;
  onIntervalChange?: (interval: Interval) => void;
  candleStyle?: CandleStyle;
  onCandleStyleChange?: (style: CandleStyle) => void;
  candleStyles?: CandleStyleOption[];
  priceScale?: PriceScale;
  onPriceScaleChange?: (scale: PriceScale) => void;
  sessions?: boolean;
  onSessionsChange?: (on: boolean) => void;
  watermark?: boolean;
  onWatermarkChange?: (on: boolean) => void;
  indicatorOptions?: IndicatorOption[];
  drawingTools?: DrawingToolOption[];
  showDrawing?: boolean;
  showSnapshot?: boolean;
  showSettings?: boolean;
  snapshotName?: string;
  className?: string;
  children?: ReactNode;
}) {
  useEffect(ensureDefaultStyles, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // Recompute which directions have hidden content. 1px slop absorbs subpixel
  // rounding so a fully-scrolled edge doesn't flicker a chevron.
  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    // Re-evaluate when the tile resizes or the toolbar's contents change width.
    // ResizeObserver may be absent (SSR, older webviews) — degrade to scroll +
    // window-resize events, which still keep the chevrons correct.
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
    }
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scrollByDir = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="sonr-toolbar-wrap">
      <div
        ref={scrollRef}
        className={className ?? "sonr-chart-toolbar"}
        role="toolbar"
        aria-label="Chart toolbar"
        onScroll={update}
      >
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
        {onCandleStyleChange && (
          <CandleMenu value={candleStyle} onChange={onCandleStyleChange} options={candleStyles} />
        )}
        <IndicatorMenu chartRef={chartRef} options={indicatorOptions} />
        {onPriceScaleChange && <PriceScaleMenu value={priceScale} onChange={onPriceScaleChange} />}
        {onSessionsChange && (
          <div className="sonr-session-group" role="group" aria-label="Sessions">
            <button
              type="button"
              className={`sonr-session-btn${sessions ? " on" : ""}`}
              aria-pressed={!!sessions}
              title="Extended-hours session tinting"
              onClick={() => onSessionsChange(!sessions)}
            >
              Sessions
            </button>
          </div>
        )}
        {showDrawing && <DrawingToolbar chartRef={chartRef} tools={drawingTools} />}
        {children}
        {showSnapshot && (
          <button
            type="button"
            className="sonr-snapshot-btn sonr-icon-btn"
            title="Save a snapshot"
            aria-label="Snapshot"
            onClick={() => downloadSnapshot(chartRef.current, snapshotName)}
          >
            <CameraIcon />
          </button>
        )}
        {showSettings && (
          <button
            type="button"
            className={`sonr-settings-btn sonr-icon-btn${settingsOpen ? " on" : ""}`}
            title="Chart settings"
            aria-label="Chart settings"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            <GearIcon />
          </button>
        )}
      </div>
      {showSettings && (
        <SettingsModal
          chartRef={chartRef}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          watermark={watermark}
          onWatermarkChange={onWatermarkChange}
        />
      )}
      {canLeft && (
        <button
          type="button"
          className="sonr-scroll-hint left"
          aria-label="Scroll toolbar left"
          tabIndex={-1}
          onClick={() => scrollByDir(-1)}
        >
          ‹
        </button>
      )}
      {canRight && (
        <button
          type="button"
          className="sonr-scroll-hint right"
          aria-label="Scroll toolbar right"
          tabIndex={-1}
          onClick={() => scrollByDir(1)}
        >
          ›
        </button>
      )}
    </div>
  );
}

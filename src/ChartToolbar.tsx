import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { SonrChartHandle } from "./SonrChart";
import type { Interval, DataSource } from "./types";
import type { CandleStyle, PriceScale } from "./types";
import { SymbolSearch } from "./SymbolSearch";
import { IndicatorMenu, type IndicatorOption } from "./IndicatorMenu";
import { CandleMenu, type CandleStyleOption } from "./CandleMenu";
import { PriceScaleMenu } from "./PriceScaleMenu";
import { DrawingToolbar } from "./DrawingToolbar";
import { type DrawingToolOption } from "./drawings";
import { downloadSnapshot } from "./snapshot";
import { ensureDefaultStyles } from "./defaultStyles";
import { CameraIcon, GearIcon } from "./icons";
import { SettingsModal } from "./SettingsModal";
import { mergeLabels, type Labels } from "./labels";

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
  indicatorOptions,
  drawingTools,
  showCandle = true,
  showScale = true,
  showSessions = true,
  showDrawing = true,
  showSnapshot = true,
  showSettings = true,
  snapshotName = "chart.png",
  dataSource,
  onSymbolSelect,
  spreadOperators,
  className,
  labels,
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
  indicatorOptions?: IndicatorOption[];
  drawingTools?: DrawingToolOption[];
  showCandle?: boolean;
  showScale?: boolean;
  showSessions?: boolean;
  showDrawing?: boolean;
  showSnapshot?: boolean;
  showSettings?: boolean;
  snapshotName?: string;
  /** DataSource used to power the optional symbol-search box (issue #37). */
  dataSource?: DataSource;
  /** When provided (with `dataSource`), a SymbolSearch renders at the toolbar's
   *  left; picking a result fires this. Omit for the pre-#37 toolbar. */
  onSymbolSelect?: (symbol: string) => void;
  /** Forwarded to SymbolSearch — allow spread/expression pass-through. */
  spreadOperators?: boolean;
  className?: string;
  /** Localized chrome strings (issue #46). Merged over English defaults and
   *  threaded to the menus/settings; omit for the current English. */
  labels?: Partial<Labels>;
  children?: ReactNode;
}) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Uncontrolled fallbacks: when the host doesn't pass an onXChange callback, the
  // candle/scale/sessions controls drive the chart directly through its handle
  // (mirrored here so they reflect state) — so they work out of the box with no
  // host wiring. A host that passes value + onXChange stays in control.
  const [uncCandle, setUncCandle] = useState<CandleStyle>("candle");
  const [uncScale, setUncScale] = useState<PriceScale>({ type: "normal" });
  const [uncSessions, setUncSessions] = useState(false);
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    let cancelled = false;
    const attach = () => {
      if (cancelled) return;
      const h = chartRef.current;
      if (!h?.subscribeCandleStyle) {
        setTimeout(attach, 50);
        return;
      }
      setUncCandle(h.getCandleStyle());
      unsubs.push(h.subscribeCandleStyle(setUncCandle));
      setUncScale(h.getPriceScale() ?? { type: "normal" });
      unsubs.push(h.subscribePriceScale(setUncScale));
      setUncSessions(!!h.getSessions());
      unsubs.push(h.subscribeSessions((v) => setUncSessions(!!v)));
    };
    attach();
    return () => {
      cancelled = true;
      for (const u of unsubs) u();
    };
  }, [chartRef]);

  const candleValue = onCandleStyleChange ? (candleStyle ?? "candle") : uncCandle;
  const candleChange = onCandleStyleChange ?? ((s: CandleStyle) => chartRef.current?.setCandleStyle(s));
  const scaleValue = onPriceScaleChange ? (priceScale ?? { type: "normal" }) : uncScale;
  const scaleChange = onPriceScaleChange ?? ((s: PriceScale) => chartRef.current?.setPriceScale(s));
  const sessionsValue = onSessionsChange ? !!sessions : uncSessions;
  const sessionsChange = onSessionsChange ?? ((on: boolean) => chartRef.current?.setSessions(on));
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
        {onSymbolSelect && dataSource && (
          <SymbolSearch
            dataSource={dataSource}
            onSelect={onSymbolSelect}
            spreadOperators={spreadOperators}
          />
        )}
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
        {showCandle && <CandleMenu value={candleValue} onChange={candleChange} options={candleStyles} labels={labels} />}
        <IndicatorMenu chartRef={chartRef} options={indicatorOptions} labels={labels} />
        {showScale && <PriceScaleMenu value={scaleValue} onChange={scaleChange} labels={labels} />}
        {showSessions && (
          <div className="sonr-session-group" role="group" aria-label={L.sessions}>
            <button
              type="button"
              className={`sonr-session-btn${sessionsValue ? " on" : ""}`}
              aria-pressed={!!sessionsValue}
              title="Extended-hours session tinting"
              onClick={() => sessionsChange(!sessionsValue)}
            >
              {L.sessions}
            </button>
          </div>
        )}
        {showDrawing && <DrawingToolbar chartRef={chartRef} tools={drawingTools} labels={labels} />}
        {children}
        {showSnapshot && (
          <button
            type="button"
            className="sonr-snapshot-btn sonr-icon-btn"
            title="Save a snapshot"
            aria-label={L.snapshot}
            onClick={() => downloadSnapshot(chartRef.current, snapshotName)}
          >
            <CameraIcon />
          </button>
        )}
        {showSettings && (
          <button
            type="button"
            className={`sonr-settings-btn sonr-icon-btn${settingsOpen ? " on" : ""}`}
            title={L.settings}
            aria-label={L.settings}
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
          labels={labels}
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

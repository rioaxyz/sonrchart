import { forwardRef, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SonrChart, type SonrChartHandle } from "./SonrChart";
import { ChartToolbar } from "./ChartToolbar";
import { ChartHeader } from "./ChartHeader";
import { DataWindow } from "./DataWindow";
import { ObjectTree } from "./ObjectTree";
import { TimeframeBar, type RangeOption } from "./TimeframeBar";
import { TimezoneMenu } from "./TimezoneMenu";
import { NavControlBar } from "./NavControlBar";
import { SaveLoadDialog } from "./SaveLoadDialog";
import { GoToDateDialog } from "./GoToDateDialog";
import { SymbolInfoDialog } from "./SymbolInfoDialog";
import { BrandMark, type BrandCorner } from "./BrandMark";
import { ToolbarButton } from "./ToolbarButton";
import { DEFAULT_DRAWING_TOOLS, EXTENDED_DRAWING_TOOLS } from "./drawings";
import { ObjectsIcon, CalendarIcon } from "./icons";
import { ensureDefaultStyles } from "./defaultStyles";
import { mergeLabels, type Labels } from "./labels";
import type {
  DataSource,
  IndicatorSpec,
  Interval,
  OrderLine,
  PatternMarker,
  PriceLine,
  SessionTint,
  Theme,
  WatermarkOptions,
} from "./types";

// Batteries-included chart shell. Where <SonrChart> is just the canvas and
// <ChartToolbar>/<DataWindow>/etc. are à-la-carte pieces, <SonrChartShell>
// composes the WHOLE application chrome — toolbar (with the timezone control,
// the extended drawing family, and an Objects panel toggle), the header, the
// side panel (data window + object tree), nav controls, the bottom timeframe
// bar with go-to-date, and the save-load / symbol-info dialogs — so a consuming
// app renders one component and only wires callbacks + passes data. Nothing here
// is app-specific: the host supplies a DataSource, symbol/interval, theme, and
// optional brand slot; everything else is self-contained.

const DEFAULT_INTERVALS: Interval[] = ["10S", "30S", "1", "5", "15", "30", "60", "D"];

// Default drawing palette: the curated set plus the opt-in extended family (#34).
const DEFAULT_SHELL_TOOLS = [...DEFAULT_DRAWING_TOOLS, ...EXTENDED_DRAWING_TOOLS];

export interface SonrChartShellProps {
  symbol: string;
  interval: Interval;
  dataSource: DataSource;
  theme?: Theme | string;
  /** Resolution buttons in the toolbar. Defaults to 10S…D. */
  intervals?: Interval[];
  /** Lookback ranges for the bottom bar. */
  ranges?: RangeOption[];
  /** Data-source label shown in the header (e.g. "Alpaca"). */
  source?: string;
  /** Instrument venue label for the Symbol-info dialog (e.g. "Alpaca"). */
  exchange?: string;
  onIntervalChange?: (interval: Interval) => void;
  onSymbolChange?: (symbol: string) => void;
  /** Brand mark content (host logo), shown in a chart corner. Omit for none. */
  brand?: ReactNode;
  brandCorner?: BrandCorner;
  brandOpacity?: number;
  /** Snapshot filename. Defaults to `${symbol}-${interval}.png`. */
  snapshotName?: string;
  // Passthroughs to <SonrChart> (sensible defaults).
  indicators?: (string | IndicatorSpec)[];
  sessions?: SessionTint;
  watermark?: boolean | Partial<WatermarkOptions>;
  patterns?: PatternMarker[];
  priceLines?: PriceLine[];
  orderLines?: OrderLine[];
  timezone?: string;
  /** Localized chrome strings, threaded to every piece. */
  labels?: Partial<Labels>;
  className?: string;
  style?: CSSProperties;
}

/**
 * The full chart application shell. Forwards a ref to the underlying
 * SonrChartHandle so a host can still drive the chart imperatively.
 */
export const SonrChartShell = forwardRef<SonrChartHandle, SonrChartShellProps>(function SonrChartShell(
  {
    symbol,
    interval,
    dataSource,
    theme,
    intervals = DEFAULT_INTERVALS,
    ranges,
    source,
    exchange = source,
    onIntervalChange,
    onSymbolChange,
    brand,
    brandCorner = "bottom-left",
    brandOpacity = 0.45,
    snapshotName,
    indicators = ["VOL"],
    sessions = true,
    watermark = true,
    patterns,
    priceLines,
    orderLines,
    timezone,
    labels,
    className,
    style,
  },
  ref,
) {
  ensureDefaultStyles();
  const chartRef = useRef<SonrChartHandle>(null);
  // Expose the inner chart handle to the host.
  useImperativeHandle(ref, () => chartRef.current as SonrChartHandle, []);

  const [panelOpen, setPanelOpen] = useState(false);
  const [saveLoadOpen, setSaveLoadOpen] = useState(false);
  const [goToDateOpen, setGoToDateOpen] = useState(false);
  const [symbolInfoOpen, setSymbolInfoOpen] = useState(false);
  const L = mergeLabels(labels);

  return (
    <div className={`sonr-tile${className ? ` ${className}` : ""}`} style={{ position: "absolute", inset: 0, ...style }}>
      <ChartToolbar
        chartRef={chartRef}
        intervals={intervals}
        interval={interval}
        onIntervalChange={(iv) => onIntervalChange?.(iv)}
        dataSource={dataSource}
        onSymbolSelect={(sym) => onSymbolChange?.(sym)}
        drawingTools={DEFAULT_SHELL_TOOLS}
        snapshotName={snapshotName ?? `${symbol}-${interval}.png`}
        labels={labels}
      >
        {/* Objects/indicators panel toggle — an icon in the top toolbar. */}
        <ToolbarButton
          className="sonr-icon-btn"
          active={panelOpen}
          title={L.panelToggle}
          aria-label={L.panelToggle}
          onClick={() => setPanelOpen((o) => !o)}
        >
          <ObjectsIcon />
        </ToolbarButton>
      </ChartToolbar>
      <div className="sonr-tile-body">
        <div className="sonr-tile-canvas">
          <SonrChart
            ref={chartRef}
            symbol={symbol}
            interval={interval}
            dataSource={dataSource}
            theme={theme}
            indicators={indicators}
            sessions={sessions}
            watermark={watermark}
            patterns={patterns}
            priceLines={priceLines}
            orderLines={orderLines}
            timezone={timezone}
            source={source}
            legend={false}
            style={{ position: "absolute", inset: 0 }}
          />
          {/* Header: ticker · interval · source, market button, OHLC. */}
          <div className="sonr-tile-header">
            <ChartHeader chartRef={chartRef} symbol={symbol} interval={interval} source={source} />
          </div>
          {/* Nav controls — bottom-right overlay. */}
          <div className="sonr-tile-nav">
            <NavControlBar chartRef={chartRef} labels={labels} />
          </div>
          {brand != null && (
            <BrandMark position={brandCorner} opacity={brandOpacity}>
              {brand}
            </BrandMark>
          )}
        </div>
        {panelOpen && (
          <aside className="sonr-side-panel">
            <div className="sonr-side-tools">
              <button type="button" className="sonr-side-tool" onClick={() => setSaveLoadOpen(true)}>
                {L.saveLoad}
              </button>
              <button type="button" className="sonr-side-tool" onClick={() => setSymbolInfoOpen(true)}>
                {L.symbolInfo}
              </button>
            </div>
            <DataWindow chartRef={chartRef} labels={labels} />
            <ObjectTree chartRef={chartRef} labels={labels} />
          </aside>
        )}
      </div>
      <TimeframeBar chartRef={chartRef} interval={interval} ranges={ranges}>
        <TimezoneMenu chartRef={chartRef} labels={labels} />
        <button
          type="button"
          className="sonr-bottom-btn"
          title={L.goToDate}
          aria-label={L.goToDate}
          onClick={() => setGoToDateOpen(true)}
        >
          <CalendarIcon />
        </button>
      </TimeframeBar>
      <SaveLoadDialog chartRef={chartRef} open={saveLoadOpen} onClose={() => setSaveLoadOpen(false)} labels={labels} />
      <GoToDateDialog chartRef={chartRef} open={goToDateOpen} onClose={() => setGoToDateOpen(false)} labels={labels} />
      <SymbolInfoDialog dataSource={dataSource} symbol={symbol} open={symbolInfoOpen} onClose={() => setSymbolInfoOpen(false)} exchange={exchange} labels={labels} />
    </div>
  );
});

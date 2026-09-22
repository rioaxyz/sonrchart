import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { SonrChartHandle } from "./SonrChart";
import { ensureDefaultStyles } from "./defaultStyles";

// A self-contained chart settings dialog (one modal, sections mirroring the
// toolbar): Candles (bullish/bearish colors), Indicators (per-active-indicator
// line color), and Grid & Crosshair. It applies changes live through the chart
// handle's raw chart() surface, so no host wiring is required — drop it in with a
// gear button (ChartToolbar does this) or render it yourself.

type Section = "candles" | "indicators" | "grid";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "candles", label: "Candles" },
  { key: "indicators", label: "Indicators" },
  { key: "grid", label: "Grid & Crosshair" },
];

// A hex fallback for color inputs (which only accept #rrggbb).
function hex(c: string | undefined, fallback: string): string {
  return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="sonr-set-row">
      <span className="sonr-set-label">{label}</span>
      {children}
    </label>
  );
}

export function SettingsModal({
  chartRef,
  open,
  onClose,
  watermark,
  onWatermarkChange,
}: {
  chartRef: RefObject<SonrChartHandle>;
  open: boolean;
  onClose: () => void;
  /** Underlaid ticker+interval watermark toggle (shown in Grid & Crosshair). */
  watermark?: boolean;
  onWatermarkChange?: (on: boolean) => void;
}) {
  useEffect(ensureDefaultStyles, []);

  const [section, setSection] = useState<Section>("candles");
  const [candleUp, setCandleUp] = useState("#35c98d");
  const [candleDown, setCandleDown] = useState("#ff6a76");
  const [gridColor, setGridColor] = useState("#1d232b");
  const [gridShow, setGridShow] = useState(true);
  const [crosshairColor, setCrosshairColor] = useState("#78828e");
  const [indicators, setIndicators] = useState<string[]>([]);
  const [indColors, setIndColors] = useState<Record<string, string>>({});
  const [uncWatermark, setUncWatermark] = useState(false);

  // Seed from the chart's current styles each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const chart = chartRef.current?.chart?.();
    if (chart) {
      const s = chart.getStyles();
      setCandleUp(hex(s?.candle?.bar?.upColor, "#35c98d"));
      setCandleDown(hex(s?.candle?.bar?.downColor, "#ff6a76"));
      setGridColor(hex(s?.grid?.horizontal?.color, "#1d232b"));
      setGridShow(s?.grid?.horizontal?.show !== false);
      setCrosshairColor(hex(s?.crosshair?.horizontal?.line?.color, "#78828e"));
    }
    setIndicators(chartRef.current?.listIndicators?.() ?? []);
    setUncWatermark(!!chartRef.current?.getWatermark?.());
    const unsubWm = chartRef.current?.subscribeWatermark?.((v) => setUncWatermark(!!v));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unsubWm?.();
    };
  }, [open, chartRef, onClose]);

  if (!open || typeof document === "undefined") return null;

  const chart = () => chartRef.current?.chart?.() ?? null;

  // Watermark: controlled by the host if it passed onWatermarkChange, otherwise
  // driven straight through the chart handle (works with no host wiring).
  const wmValue = onWatermarkChange ? !!watermark : uncWatermark;
  const wmChange = onWatermarkChange ?? ((on: boolean) => chartRef.current?.setWatermark(on));

  const applyCandles = (up: string, down: string) => {
    chart()?.setStyles({
      candle: {
        bar: {
          upColor: up,
          upBorderColor: up,
          upWickColor: up,
          downColor: down,
          downBorderColor: down,
          downWickColor: down,
        },
      },
    });
  };
  const applyGrid = (color: string, show: boolean) => {
    chart()?.setStyles({ grid: { horizontal: { color, show }, vertical: { color, show } } });
  };
  const applyCrosshair = (color: string) => {
    chart()?.setStyles({ crosshair: { horizontal: { line: { color } }, vertical: { line: { color } } } });
  };
  const applyIndicator = (name: string, color: string) => {
    // Colour every line the same; KLineChart uses as many entries as the
    // indicator has and ignores the rest.
    chart()?.overrideIndicator({ name, styles: { lines: Array.from({ length: 6 }, () => ({ color })) } });
  };

  return createPortal(
    <div className="sonr-set-overlay" role="dialog" aria-modal="true" aria-label="Chart settings" onMouseDown={onClose}>
      <div className="sonr-set-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sonr-set-head">
          <span className="sonr-set-title">Chart settings</span>
          <button type="button" className="sonr-set-close" aria-label="Close settings" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sonr-set-body">
          <nav className="sonr-set-nav" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`sonr-set-navbtn${section === s.key ? " on" : ""}`}
                aria-current={section === s.key}
                onClick={() => setSection(s.key)}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <div className="sonr-set-content">
            {section === "candles" && (
              <>
                <Row label="Bullish (up)">
                  <input
                    type="color"
                    value={candleUp}
                    onChange={(e) => {
                      setCandleUp(e.target.value);
                      applyCandles(e.target.value, candleDown);
                    }}
                  />
                </Row>
                <Row label="Bearish (down)">
                  <input
                    type="color"
                    value={candleDown}
                    onChange={(e) => {
                      setCandleDown(e.target.value);
                      applyCandles(candleUp, e.target.value);
                    }}
                  />
                </Row>
              </>
            )}
            {section === "indicators" && (
              <>
                <p className="sonr-set-note">An indicator must be active on the chart to change its settings — add it from the Indicators menu first.</p>
                {indicators.length === 0 && <p className="sonr-set-empty">No indicators active.</p>}
                {indicators.map((name) => (
                  <Row key={name} label={name}>
                    <input
                      type="color"
                      value={hex(indColors[name], "#a970ff")}
                      onChange={(e) => {
                        const c = e.target.value;
                        setIndColors((m) => ({ ...m, [name]: c }));
                        applyIndicator(name, c);
                      }}
                    />
                  </Row>
                ))}
              </>
            )}
            {section === "grid" && (
              <>
                <Row label="Watermark (symbol + interval)">
                  <input type="checkbox" checked={wmValue} onChange={(e) => wmChange(e.target.checked)} />
                </Row>
                <Row label="Show grid">
                  <input
                    type="checkbox"
                    checked={gridShow}
                    onChange={(e) => {
                      setGridShow(e.target.checked);
                      applyGrid(gridColor, e.target.checked);
                    }}
                  />
                </Row>
                <Row label="Grid color">
                  <input
                    type="color"
                    value={gridColor}
                    onChange={(e) => {
                      setGridColor(e.target.value);
                      applyGrid(e.target.value, gridShow);
                    }}
                  />
                </Row>
                <Row label="Crosshair color">
                  <input
                    type="color"
                    value={crosshairColor}
                    onChange={(e) => {
                      setCrosshairColor(e.target.value);
                      applyCrosshair(e.target.value);
                    }}
                  />
                </Row>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

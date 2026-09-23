import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { SonrChartHandle } from "./SonrChart";
import type { BrushStyle, BrushTool } from "./brush";
import { ensureDefaultStyles } from "./defaultStyles";

// A self-contained chart settings dialog (one modal, sections mirroring the
// toolbar): Candles (bullish/bearish colors), Indicators (per-active-indicator
// line color), and Grid & Crosshair. It applies changes live through the chart
// handle's raw chart() surface, so no host wiring is required — drop it in with a
// gear button (ChartToolbar does this) or render it yourself.

type Section = "candles" | "indicators" | "grid" | "drawing";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "candles", label: "Candles" },
  { key: "indicators", label: "Indicators" },
  { key: "grid", label: "Grid & Crosshair" },
  { key: "drawing", label: "Drawing" },
];

const BRUSH_TOOLS: { tool: BrushTool; label: string }[] = [
  { tool: "brush", label: "Brush" },
  { tool: "highlighter", label: "Highlighter" },
];

// A hex fallback for color inputs (which only accept #rrggbb).
function hex(c: string | undefined, fallback: string): string {
  return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
}

// Split a color string into a #rrggbb hex (for <input type=color>) and an alpha
// 0..1 (for a slider), and recombine — so translucent strokes stay editable.
function parseColor(c: string): { hex: string; alpha: number } {
  const m = c.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)/i);
  if (m) {
    const to2 = (v: string) => Number(v).toString(16).padStart(2, "0");
    return { hex: `#${to2(m[1])}${to2(m[2])}${to2(m[3])}`, alpha: m[4] !== undefined ? Number(m[4]) : 1 };
  }
  return { hex: hex(c, "#888888"), alpha: 1 };
}
function composeColor(h: string, alpha: number): string {
  if (alpha >= 1) return h;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.round(alpha * 100) / 100})`;
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
  const [indParams, setIndParams] = useState<Record<string, number[]>>({});
  const [uncWatermark, setUncWatermark] = useState(false);
  const [brushStyles, setBrushStyles] = useState<Record<BrushTool, BrushStyle>>({
    brush: { color: "#e6ebe9", size: 2 },
    highlighter: { color: "rgba(245,214,66,0.35)", size: 14 },
  });

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
    const names = chartRef.current?.listIndicators?.() ?? [];
    setIndicators(names);
    // Seed each active indicator's calculation params from the raw chart, so the
    // inputs editor shows the live values. Only keep non-empty numeric arrays.
    const params: Record<string, number[]> = {};
    for (const name of names) {
      const found = chart?.getIndicators?.({ name });
      const cp = Array.isArray(found) ? (found[0]?.calcParams as unknown) : undefined;
      if (Array.isArray(cp) && cp.length > 0 && cp.every((n) => typeof n === "number")) {
        params[name] = cp.slice();
      }
    }
    setIndParams(params);
    setUncWatermark(!!chartRef.current?.getWatermark?.());
    const unsubWm = chartRef.current?.subscribeWatermark?.((v) => setUncWatermark(!!v));
    const readBrush = () => {
      const h = chartRef.current;
      if (h?.getBrushStyle) setBrushStyles({ brush: h.getBrushStyle("brush"), highlighter: h.getBrushStyle("highlighter") });
    };
    readBrush();
    const unsubBrush = chartRef.current?.subscribeBrush?.(readBrush);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unsubWm?.();
      unsubBrush?.();
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
  const applyIndicatorParams = (name: string, idx: number, value: number) => {
    setIndParams((m) => {
      const next = (m[name] ?? []).slice();
      next[idx] = value;
      chart()?.overrideIndicator({ name, calcParams: next });
      return { ...m, [name]: next };
    });
  };
  const applyBrush = (tool: BrushTool, style: BrushStyle) => {
    chartRef.current?.setBrushStyle?.(tool, style);
    setBrushStyles((m) => ({ ...m, [tool]: style }));
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
                {indicators.map((name) => {
                  const params = indParams[name];
                  return (
                    <div key={name} className="sonr-set-ind">
                      <Row label={name}>
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
                      {params && params.length > 0 && (
                        <div className="sonr-set-inputs" role="group" aria-label={`${name} inputs`}>
                          <span className="sonr-set-inputs-label">Inputs</span>
                          {params.map((p, idx) => (
                            <input
                              key={idx}
                              type="number"
                              className="sonr-set-num"
                              aria-label={`${name} input ${idx + 1}`}
                              value={p}
                              onChange={(e) => {
                                const v = e.target.valueAsNumber;
                                if (Number.isNaN(v)) return;
                                applyIndicatorParams(name, idx, v);
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
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
            {section === "drawing" && (
              <>
                <p className="sonr-set-note">Stroke settings for the freehand brush &amp; highlighter — applied to the strokes you draw next.</p>
                {BRUSH_TOOLS.map(({ tool, label }) => {
                  const st = brushStyles[tool];
                  const { hex: h, alpha } = parseColor(st.color);
                  return (
                    <div key={tool} className="sonr-set-ind">
                      <div className="sonr-set-subhead">{label}</div>
                      <Row label="Color">
                        <input type="color" value={h} onChange={(e) => applyBrush(tool, { ...st, color: composeColor(e.target.value, alpha) })} />
                      </Row>
                      <Row label={`Opacity (${Math.round(alpha * 100)}%)`}>
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          value={alpha}
                          onChange={(e) => applyBrush(tool, { ...st, color: composeColor(h, Number(e.target.value)) })}
                        />
                      </Row>
                      <Row label="Width (px)">
                        <input
                          type="number"
                          min="1"
                          max="40"
                          value={st.size}
                          onChange={(e) => applyBrush(tool, { ...st, size: Math.max(1, Math.min(40, Number(e.target.value) || 1)) })}
                        />
                      </Row>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

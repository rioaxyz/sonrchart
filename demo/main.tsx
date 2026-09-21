import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { SonrChart, ChartToolbar, ToolbarButton, type SonrChartHandle } from "../src";
import type { CandleStyle, Interval, OrderLine, PatternMarker, PriceScale, Theme } from "../src/types";
import { syntheticSource } from "./syntheticSource";

const INTERVALS: Interval[] = ["10S", "1", "5", "15", "60", "D"];
const CANDLE_STYLES: CandleStyle[] = ["candle", "hollow", "ohlc", "area", "heikin_ashi"];

function Demo() {
  const [interval, setInterval] = useState<Interval>("1");
  const [theme, setTheme] = useState<Theme>("dark");
  const [showPlan, setShowPlan] = useState(true);
  const [sessions, setSessions] = useState(true);
  const [magnet, setMagnet] = useState<boolean>(true);
  const [scaleType, setScaleType] = useState<PriceScale["type"]>("normal");
  const [candleStyle, setCandleStyle] = useState<CandleStyle>("candle");
  const [compareOn, setCompareOn] = useState(false);
  const [entry, setEntry] = useState(100.0);
  const chartRef = useRef<SonrChartHandle>(null);
  // Symbol-aware source: SYNTH seeds ~100, other tickers seed elsewhere, so a
  // compare overlay visibly diverges from the main series.
  const source = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof syntheticSource>>();
    const get = (sym: string) => {
      let s = cache.get(sym);
      if (!s) { s = syntheticSource(sym === "SYNTH" ? 100 : 40 + (sym.charCodeAt(0) % 60)); cache.set(sym, s); }
      return s;
    };
    return {
      getBars: (sym: string, iv: Interval, n: number) => get(sym).getBars(sym, iv, n),
      subscribe: (sym: string, iv: Interval, cb: (b: any) => void) => get(sym).subscribe!(sym, iv, cb),
    };
  }, []);

  const priceLines = showPlan
    ? [
        { price: 101.5, color: "#35c98d", label: "Target", style: "dashed" as const },
        { price: 98.8, color: "#ff6a76", label: "Stop", style: "dashed" as const },
      ]
    : [];
  const orderLines: OrderLine[] = showPlan
    ? [{ id: "entry", price: entry, color: "#7d93e8", label: "Entry (drag me)", onMove: (p, phase) => phase === "end" && setEntry(+p.toFixed(2)) }]
    : [];
  const now = Date.now();
  const patterns: PatternMarker[] = [
    { time: now - 60_000 * 40, kind: "long", label: "AT" },
    { time: now - 60_000 * 12, kind: "short", label: "RW" },
  ];

  const scaleBtn = (t: PriceScale["type"], label: string) => (
    <button key={t} onClick={() => setScaleType(t)} style={btn(scaleType === t, theme)}>{label}</button>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: theme === "dark" ? "#0b0d10" : "#f5f7fa" }}>
      <header style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 14px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: theme === "dark" ? "#e6ebe9" : "#1a1f29", borderBottom: `1px solid ${theme === "dark" ? "#1d232b" : "#d8dee8"}`, flexWrap: "wrap" }}>
        <strong style={{ letterSpacing: "0.04em" }}>sonrchart</strong>
        <span style={{ opacity: 0.6 }}>entry {entry.toFixed(2)}</span>
        <ChartToolbar chartRef={chartRef} intervals={INTERVALS} interval={interval} onIntervalChange={setInterval} snapshotName="sonrchart.png">
          {/* Custom header buttons via the children slot + ToolbarButton (#18) */}
          <ToolbarButton onClick={() => chartRef.current?.undo()} title="Undo drawing">Undo</ToolbarButton>
          <ToolbarButton onClick={() => chartRef.current?.redo()} title="Redo drawing">Redo</ToolbarButton>
        </ChartToolbar>
        <select value={candleStyle} onChange={(e) => setCandleStyle(e.target.value as CandleStyle)} style={{ ...btn(false, theme), padding: "3px 6px" }}>
          {CANDLE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ display: "flex", gap: 4 }}>{scaleBtn("normal", "lin")}{scaleBtn("logarithm", "log")}{scaleBtn("percentage", "%")}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button onClick={() => setCompareOn((c) => !c)} style={btn(compareOn, theme)}>Compare</button>
          <button onClick={() => setMagnet((m) => !m)} style={btn(magnet, theme)}>Magnet</button>
          <button onClick={() => setSessions((s) => !s)} style={btn(sessions, theme)}>Sessions</button>
          <button onClick={() => setShowPlan((s) => !s)} style={btn(showPlan, theme)}>Plan</button>
          <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} style={btn(false, theme)}>{theme === "dark" ? "☾" : "☀"}</button>
        </span>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SonrChart
          ref={chartRef}
          symbol="SYNTH"
          interval={interval}
          theme={theme}
          dataSource={source}
          indicators={["VOL"]}
          sessions={sessions}
          patterns={patterns}
          priceLines={priceLines}
          orderLines={orderLines}
          priceScale={{ type: scaleType }}
          magnet={magnet}
          candleStyle={candleStyle}
          compareSeries={compareOn ? [{ symbol: "SPY", color: "#e0a33c" }] : []}
        />
      </div>
      <style>{`
        .sonr-chart-toolbar, .sonr-interval-group, .sonr-indicator-menu, .sonr-drawing-toolbar { display: inline-flex; gap: 3px; align-items: center; }
        .sonr-chart-toolbar { gap: 8px; flex-wrap: wrap; }
        .sonr-iv-btn, .sonr-ind-btn, .sonr-draw-btn, .sonr-snapshot-btn, .sonr-tb-btn {
          font: 600 11px ui-monospace, Menlo, monospace; padding: 3px 7px; border-radius: 5px; cursor: pointer;
          border: 1px solid ${theme === "dark" ? "#1d232b" : "#d8dee8"}; background: transparent; color: ${theme === "dark" ? "#78828e" : "#5c6675"}; }
        .sonr-iv-btn.on { border-color: #35c98d; background: #0f1d17; color: #35c98d; }
        .sonr-ind-btn.on { border-color: #5319e7; background: #14103a; color: #b9a9ff; }
        .sonr-draw-clear { color: #ff6a76; }
      `}</style>
    </div>
  );
}

function btn(on: boolean, theme: Theme): React.CSSProperties {
  return {
    fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, padding: "4px 9px", borderRadius: 6, cursor: "pointer",
    border: `1px solid ${on ? "#35c98d" : theme === "dark" ? "#1d232b" : "#d8dee8"}`,
    background: on ? "#0f1d17" : "transparent",
    color: on ? "#35c98d" : theme === "dark" ? "#78828e" : "#5c6675",
  };
}

createRoot(document.getElementById("root")!).render(<Demo />);

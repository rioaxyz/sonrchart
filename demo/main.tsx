import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { SonrChart, IndicatorMenu, type SonrChartHandle } from "../src";
import type { Interval, OrderLine, PatternMarker, Theme } from "../src/types";
import { syntheticSource } from "./syntheticSource";

const INTERVALS: Interval[] = ["10S", "1", "5", "15", "60", "D"];

function Demo() {
  const [interval, setInterval] = useState<Interval>("1");
  const [theme, setTheme] = useState<Theme>("dark");
  const [showPlan, setShowPlan] = useState(true);
  const [sessions, setSessions] = useState(true);
  const [entry, setEntry] = useState(100.0);
  const chartRef = useRef<SonrChartHandle>(null);
  const source = useMemo(() => syntheticSource(100), []);

  // Static plan lines (issue: priceLines, shipped) — target & stop.
  const priceLines = showPlan
    ? [
        { price: 101.5, color: "#35c98d", label: "Target", style: "dashed" as const },
        { price: 98.8, color: "#ff6a76", label: "Stop", style: "dashed" as const },
      ]
    : [];

  // Draggable order line (#19) — drag it to move the entry.
  const orderLines: OrderLine[] = showPlan
    ? [{ id: "entry", price: entry, color: "#7d93e8", label: "Entry (drag me)", onMove: (p, phase) => phase === "end" && setEntry(+p.toFixed(2)) }]
    : [];

  // Pattern markers (#5) — a couple of setup triggers on recent bars.
  const now = Date.now();
  const patterns: PatternMarker[] = [
    { time: now - 60_000 * 40, kind: "long", label: "AT" },
    { time: now - 60_000 * 12, kind: "short", label: "RW" },
  ];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: theme === "dark" ? "#0b0d10" : "#f5f7fa" }}>
      <header style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: theme === "dark" ? "#e6ebe9" : "#1a1f29", borderBottom: `1px solid ${theme === "dark" ? "#1d232b" : "#d8dee8"}`, flexWrap: "wrap" }}>
        <strong style={{ letterSpacing: "0.04em" }}>sonrchart</strong>
        <span style={{ opacity: 0.6 }}>SYNTH · entry {entry.toFixed(2)}</span>
        <span style={{ display: "flex", gap: 4 }}>
          {INTERVALS.map((iv) => (
            <button key={iv} onClick={() => setInterval(iv)} style={btn(interval === iv, theme)}>{iv}</button>
          ))}
        </span>
        {/* Indicator config UI (#4) */}
        <IndicatorMenu chartRef={chartRef} className="demo-ind-menu" />
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button onClick={() => setSessions((s) => !s)} style={btn(sessions, theme)}>Sessions</button>
          <button onClick={() => setShowPlan((s) => !s)} style={btn(showPlan, theme)}>Plan</button>
          <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} style={btn(false, theme)}>
            {theme === "dark" ? "☾" : "☀"}
          </button>
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
        />
      </div>
      <style>{`
        .demo-ind-menu { display: inline-flex; gap: 3px; }
        .sonr-ind-btn { font: 600 11px ui-monospace, Menlo, monospace; padding: 3px 7px; border-radius: 5px; cursor: pointer;
          border: 1px solid ${theme === "dark" ? "#1d232b" : "#d8dee8"}; background: transparent; color: ${theme === "dark" ? "#78828e" : "#5c6675"}; }
        .sonr-ind-btn.on { border-color: #5319e7; background: #14103a; color: #b9a9ff; }
      `}</style>
    </div>
  );
}

function btn(on: boolean, theme: Theme): React.CSSProperties {
  return {
    fontFamily: "ui-monospace, Menlo, monospace",
    fontSize: 11,
    padding: "4px 9px",
    borderRadius: 6,
    cursor: "pointer",
    border: `1px solid ${on ? "#35c98d" : theme === "dark" ? "#1d232b" : "#d8dee8"}`,
    background: on ? "#0f1d17" : "transparent",
    color: on ? "#35c98d" : theme === "dark" ? "#78828e" : "#5c6675",
  };
}

createRoot(document.getElementById("root")!).render(<Demo />);

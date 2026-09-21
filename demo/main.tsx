import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { SonrChart } from "../src";
import type { Interval, Theme } from "../src/types";
import { syntheticSource } from "./syntheticSource";

const INTERVALS: Interval[] = ["10S", "1", "5", "15", "60", "D"];

function Demo() {
  const [interval, setInterval] = useState<Interval>("1");
  const [theme, setTheme] = useState<Theme>("dark");
  const [showPlan, setShowPlan] = useState(true);
  const source = useMemo(() => syntheticSource(100), []);

  const priceLines = showPlan
    ? [
        { price: 101.5, color: "#35c98d", label: "Target", style: "dashed" as const },
        { price: 100.0, color: "#7d93e8", label: "Entry" },
        { price: 98.8, color: "#ff6a76", label: "Stop", style: "dashed" as const },
      ]
    : [];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: theme === "dark" ? "#0b0d10" : "#f5f7fa" }}>
      <header style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: theme === "dark" ? "#e6ebe9" : "#1a1f29", borderBottom: `1px solid ${theme === "dark" ? "#1d232b" : "#d8dee8"}` }}>
        <strong style={{ letterSpacing: "0.04em" }}>sonrchart</strong>
        <span style={{ opacity: 0.6 }}>SYNTH · 100.00</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {INTERVALS.map((iv) => (
            <button key={iv} onClick={() => setInterval(iv)} style={btn(interval === iv, theme)}>{iv}</button>
          ))}
        </span>
        <button onClick={() => setShowPlan((s) => !s)} style={btn(showPlan, theme)}>Plan</button>
        <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} style={btn(false, theme)}>
          {theme === "dark" ? "☾" : "☀"}
        </button>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SonrChart symbol="SYNTH" interval={interval} theme={theme} dataSource={source} priceLines={priceLines} />
      </div>
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

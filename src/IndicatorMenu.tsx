import { useEffect, useState, type RefObject } from "react";
import type { SonrChartHandle } from "./SonrChart";

// A drop-in indicator config UI (issue #4). It drives a SonrChart through its
// imperative handle: toggling a row adds/removes that indicator live. Hosts can
// use this as-is or build their own UI on the same handle API.

/** Common KLineChart indicators offered by default. `pane` decides overlay vs
 *  sub-pane. Override via the `options` prop. */
export interface IndicatorOption {
  name: string;
  label: string;
  pane?: "main" | "new";
}

export const DEFAULT_INDICATOR_OPTIONS: IndicatorOption[] = [
  { name: "MA", label: "Moving Average", pane: "main" },
  { name: "EMA", label: "Exp. Moving Average", pane: "main" },
  { name: "BOLL", label: "Bollinger Bands", pane: "main" },
  { name: "SAR", label: "Parabolic SAR", pane: "main" },
  { name: "VOL", label: "Volume", pane: "new" },
  { name: "MACD", label: "MACD", pane: "new" },
  { name: "RSI", label: "RSI", pane: "new" },
  { name: "KDJ", label: "KDJ", pane: "new" },
];

export function IndicatorMenu({
  chartRef,
  options = DEFAULT_INDICATOR_OPTIONS,
  className,
}: {
  chartRef: RefObject<SonrChartHandle>;
  options?: IndicatorOption[];
  className?: string;
}) {
  const [active, setActive] = useState<string[]>([]);

  // Seed from whatever the chart already has once it's mounted.
  useEffect(() => {
    const t = setTimeout(() => setActive(chartRef.current?.listIndicators() ?? []), 0);
    return () => clearTimeout(t);
  }, [chartRef]);

  const toggle = (opt: IndicatorOption) => {
    const handle = chartRef.current;
    if (!handle) return;
    if (active.includes(opt.name)) {
      handle.removeIndicator(opt.name);
      setActive((a) => a.filter((n) => n !== opt.name));
    } else {
      handle.addIndicator({ name: opt.name, pane: opt.pane });
      setActive((a) => [...a, opt.name]);
    }
  };

  return (
    <div className={className ?? "sonr-indicator-menu"} role="group" aria-label="Indicators">
      {options.map((opt) => {
        const on = active.includes(opt.name);
        return (
          <button
            key={opt.name}
            type="button"
            className={`sonr-ind-btn${on ? " on" : ""}`}
            aria-pressed={on}
            title={opt.label}
            onClick={() => toggle(opt)}
          >
            {opt.name}
          </button>
        );
      })}
    </div>
  );
}

import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import type { SonrChartHandle } from "./SonrChart";
import type { Interval } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";

// Bottom timeframe bar (issue #45) — TradingView's *lookback range* selector,
// NOT a resolution picker (that's the top toolbar's interval). Each button
// zooms the visible window to the last N of its period (1D / 5D / 1M / …) at
// whatever resolution is currently selected, so "1M" with a 30m interval shows
// "1 month in 30 minute intervals" (the button's tooltip). Drives the chart
// through the handle's setVisibleDuration; the last-picked range is highlighted.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** One lookback button: a label, the window length in ms (Infinity = all data),
 *  and the words used in the "{range} in {interval} intervals" tooltip. */
export interface RangeOption {
  label: string;
  ms: number;
  title: string;
}

export const DEFAULT_RANGES: RangeOption[] = [
  { label: "1D", ms: DAY, title: "1 day" },
  { label: "5D", ms: 5 * DAY, title: "5 days" },
  { label: "1M", ms: 30 * DAY, title: "1 month" },
  { label: "3M", ms: 90 * DAY, title: "3 months" },
];

// Resolution → words for the tooltip ("30 minutes", "1 hour", …).
function intervalWords(iv: Interval): string {
  const map: Record<string, string> = {
    "10S": "10 second",
    "30S": "30 second",
    "1": "1 minute",
    "5": "5 minute",
    "15": "15 minute",
    "30": "30 minute",
    "60": "1 hour",
    D: "1 day",
    "1D": "1 day",
    "1440": "1 day",
  };
  return map[iv] ?? `${iv}`;
}

export function TimeframeBar({
  chartRef,
  interval,
  ranges = DEFAULT_RANGES,
  className,
  children,
}: {
  chartRef: RefObject<SonrChartHandle>;
  /** Current resolution — only used to render the tooltip. */
  interval: Interval;
  /** Lookback ranges to offer, in display order (defaults to DEFAULT_RANGES). */
  ranges?: RangeOption[];
  className?: string;
  /** Optional right-aligned slot for host nav/control widgets. */
  children?: ReactNode;
}) {
  useEffect(ensureDefaultStyles, []);
  // The last-picked range, highlighted until zoom/scroll drifts (uncontrolled —
  // a lookback is a quick action, not persistent state).
  const [active, setActive] = useState<string | null>(null);
  const words = useMemo(() => intervalWords(interval), [interval]);

  return (
    <div className={className ?? "sonr-timeframe-bar"} role="group" aria-label="Timeframe range">
      <div className="sonr-timeframe-list">
        {ranges.map((r) => {
          const on = r.label === active;
          return (
            <button
              key={r.label}
              type="button"
              className={`sonr-timeframe-btn${on ? " on" : ""}`}
              aria-pressed={on}
              title={`${r.title} in ${words} intervals`}
              onClick={() => {
                chartRef.current?.setVisibleDuration?.(r.ms);
                setActive(r.label);
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      {children != null && <div className="sonr-timeframe-slot">{children}</div>}
    </div>
  );
}

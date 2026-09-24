import { useEffect, useMemo, type ReactNode } from "react";
import type { Interval } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";

// Bottom timeframe bar (issue #45): a compact, always-visible row of resolution
// buttons (10s / 1m / 5m / … / D) that switch the chart interval, like
// TradingView's bottom bar. Controlled — the host owns `interval` and applies
// `onIntervalChange` (the same one it feeds the chart), so this stays a thin,
// stateless view. A `children` slot on the right holds host nav/control widgets.

// Friendly default labels; a host can override any via `labels`.
const DEFAULT_LABELS: Record<string, string> = {
  "10S": "10s",
  "30S": "30s",
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  D: "D",
  "1D": "D",
  "1440": "D",
};

export function TimeframeBar({
  intervals,
  interval,
  onIntervalChange,
  labels,
  className,
  children,
}: {
  /** Resolutions to offer, in display order. */
  intervals: Interval[];
  /** The active resolution (controlled). */
  interval: Interval;
  /** Called with the picked resolution. */
  onIntervalChange: (interval: Interval) => void;
  /** Per-interval label overrides (fall back to friendly defaults, then raw). */
  labels?: Partial<Record<string, string>>;
  className?: string;
  /** Optional right-aligned slot for host nav/control widgets. */
  children?: ReactNode;
}) {
  useEffect(ensureDefaultStyles, []);
  const labelFor = useMemo(() => (iv: Interval) => labels?.[iv] ?? DEFAULT_LABELS[iv] ?? iv, [labels]);

  return (
    <div className={className ?? "sonr-timeframe-bar"} role="group" aria-label="Timeframes">
      <div className="sonr-timeframe-list">
        {intervals.map((iv) => {
          const on = iv === interval;
          return (
            <button
              key={iv}
              type="button"
              className={`sonr-timeframe-btn${on ? " on" : ""}`}
              aria-pressed={on}
              title={labelFor(iv)}
              onClick={() => {
                if (!on) onIntervalChange(iv);
              }}
            >
              {labelFor(iv)}
            </button>
          );
        })}
      </div>
      {children != null && <div className="sonr-timeframe-slot">{children}</div>}
    </div>
  );
}

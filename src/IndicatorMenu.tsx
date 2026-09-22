import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { SonrChartHandle } from "./SonrChart";
import { ensureDefaultStyles } from "./defaultStyles";
import { useDropdown } from "./useDropdown";

// A drop-in indicator config UI (issue #4). A single toolbar button opens a
// dropdown list of indicators; toggling a row adds/removes it live through the
// SonrChart handle. The list is a dropdown (not a flat button row) so it stays
// compact no matter how many indicators are offered. Hosts can use this as-is or
// build their own UI on the same handle API.

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
  { name: "VWAP", label: "Volume Weighted Avg Price", pane: "main" },
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
  useEffect(ensureDefaultStyles, []);

  const [active, setActive] = useState<string[]>([]);
  const { open, toggle: toggleOpen, pos, triggerRef, panelRef } = useDropdown();

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

  const count = active.length;

  return (
    <div className={className ?? "sonr-indicator-menu"} role="group" aria-label="Indicators">
      <button
        ref={triggerRef}
        type="button"
        className={`sonr-menu-trigger${open ? " open" : ""}${count > 0 ? " on" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        Indicators{count > 0 ? ` (${count})` : ""}
        <span className="sonr-menu-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="sonr-menu-dropdown"
            role="menu"
            aria-label="Indicators"
            style={{ position: "fixed", top: pos.top, left: pos.left }}
          >
            {options.map((opt) => {
              const on = active.includes(opt.name);
              return (
                <button
                  key={opt.name}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  className={`sonr-menu-option${on ? " on" : ""}`}
                  title={opt.label}
                  onClick={() => toggle(opt)}
                >
                  <span className="sonr-menu-check" aria-hidden>
                    {on ? "✓" : ""}
                  </span>
                  <span className="sonr-menu-name">{opt.name}</span>
                  <span className="sonr-menu-label">{opt.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

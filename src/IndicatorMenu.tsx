import { useEffect, useMemo, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { SonrChartHandle } from "./SonrChart";
import { ensureDefaultStyles } from "./defaultStyles";
import { useDropdown } from "./useDropdown";
import { mergeLabels, type Labels } from "./labels";

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

/** Menu row for the volume-trend header row (#79). Not a KLineChart study —
 *  toggling it flips the chart-level flag (setVolumeTrendEnabled) that a
 *  mounted <ChartHeader> follows. */
export const VOLUME_TREND_OPTION = "VOLTREND";

export const DEFAULT_INDICATOR_OPTIONS: IndicatorOption[] = [
  // Price-pane overlays.
  { name: "MA", label: "Moving Average", pane: "main" },
  { name: "EMA", label: "Exp. Moving Average", pane: "main" },
  { name: "SMA", label: "Smoothed Moving Average", pane: "main" },
  { name: "BBI", label: "Bull & Bear Index", pane: "main" },
  { name: "BOLL", label: "Bollinger Bands", pane: "main" },
  { name: "SAR", label: "Parabolic SAR", pane: "main" },
  { name: "DMA", label: "Difference of MA", pane: "main" },
  { name: "VWAP", label: "Volume Weighted Avg Price", pane: "main" },
  // Sub-pane oscillators & volume studies.
  { name: "VOL", label: "Volume", pane: "new" },
  { name: VOLUME_TREND_OPTION, label: "Volume Trend (header row)" },
  { name: "MACD", label: "MACD", pane: "new" },
  { name: "RSI", label: "Relative Strength Index", pane: "new" },
  { name: "KDJ", label: "KDJ Stochastic", pane: "new" },
  { name: "BIAS", label: "Bias", pane: "new" },
  { name: "BRAR", label: "BRAR", pane: "new" },
  { name: "CCI", label: "Commodity Channel Index", pane: "new" },
  { name: "DMI", label: "Directional Movement Index", pane: "new" },
  { name: "CR", label: "CR Energy", pane: "new" },
  { name: "PSY", label: "Psychological Line", pane: "new" },
  { name: "TRIX", label: "TRIX", pane: "new" },
  { name: "OBV", label: "On-Balance Volume", pane: "new" },
  { name: "VR", label: "Volume Ratio", pane: "new" },
  { name: "WR", label: "Williams %R", pane: "new" },
  { name: "MTM", label: "Momentum", pane: "new" },
  { name: "EMV", label: "Ease of Movement", pane: "new" },
  { name: "ROC", label: "Rate of Change", pane: "new" },
  { name: "PVT", label: "Price Volume Trend", pane: "new" },
  { name: "AO", label: "Awesome Oscillator", pane: "new" },
];

export function IndicatorMenu({
  chartRef,
  options = DEFAULT_INDICATOR_OPTIONS,
  className,
  labels,
}: {
  chartRef: RefObject<SonrChartHandle>;
  options?: IndicatorOption[];
  className?: string;
  labels?: Partial<Labels>;
}) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);

  const [active, setActive] = useState<string[]>([]);
  const { open, toggle: toggleOpen, pos, triggerRef, panelRef } = useDropdown();

  // Seed from whatever the chart already has once it's mounted, and track the
  // volume-trend flag so a toggle from anywhere (header prop, host button)
  // keeps this menu's checkmark honest.
  useEffect(() => {
    let unsubOn: (() => void) | undefined;
    const t = setTimeout(() => {
      const h = chartRef.current;
      const base = h?.listIndicators() ?? [];
      setActive(h?.getVolumeTrendEnabled?.() ? [...base, VOLUME_TREND_OPTION] : base);
      unsubOn = h?.subscribeVolumeTrendEnabled?.((on) =>
        setActive((a) => (on ? (a.includes(VOLUME_TREND_OPTION) ? a : [...a, VOLUME_TREND_OPTION]) : a.filter((n) => n !== VOLUME_TREND_OPTION))),
      );
    }, 0);
    return () => {
      clearTimeout(t);
      unsubOn?.();
    };
  }, [chartRef]);

  const toggle = (opt: IndicatorOption) => {
    const handle = chartRef.current;
    if (!handle) return;
    if (opt.name === VOLUME_TREND_OPTION) {
      // Not a chart study — flip the chart-level header-row flag; `active`
      // updates through the subscription above.
      handle.setVolumeTrendEnabled?.(!active.includes(opt.name));
      return;
    }
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
    <div className={className ?? "sonr-indicator-menu"} role="group" aria-label={L.indicators}>
      <button
        ref={triggerRef}
        type="button"
        className={`sonr-menu-trigger${open ? " open" : ""}${count > 0 ? " on" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        {L.indicators}{count > 0 ? ` (${count})` : ""}
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
            aria-label={L.indicators}
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

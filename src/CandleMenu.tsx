import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { CandleStyle } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";
import { useDropdown } from "./useDropdown";
import { CandleIcon } from "./icons";

// A single-select dropdown for the candle rendering style (#1), driven by props
// (like the interval control) rather than the chart ref — the host owns the
// value and passes it to both <SonrChart candleStyle> and here. Selecting a row
// changes the style and closes the menu.

export interface CandleStyleOption {
  style: CandleStyle;
  label: string;
}

export const DEFAULT_CANDLE_STYLES: CandleStyleOption[] = [
  { style: "candle", label: "Candles" },
  { style: "hollow", label: "Hollow candles" },
  { style: "ohlc", label: "Bars (OHLC)" },
  { style: "hlc", label: "HLC bars" },
  { style: "high_low", label: "High-Low" },
  { style: "heikin_ashi", label: "Heikin Ashi" },
  { style: "line", label: "Line" },
  { style: "step", label: "Step line" },
  { style: "area", label: "Area" },
  { style: "baseline", label: "Baseline" },
  { style: "column", label: "Column" },
];

export function CandleMenu({
  value = "candle",
  onChange,
  options = DEFAULT_CANDLE_STYLES,
  className,
}: {
  value?: CandleStyle;
  onChange?: (style: CandleStyle) => void;
  options?: CandleStyleOption[];
  className?: string;
}) {
  useEffect(ensureDefaultStyles, []);

  const { open, setOpen, toggle: toggleOpen, pos, triggerRef, panelRef } = useDropdown();
  const current = options.find((o) => o.style === value);

  const pick = (style: CandleStyle) => {
    onChange?.(style);
    setOpen(false);
  };

  return (
    <div className={className ?? "sonr-candle-menu"} role="group" aria-label="Candle type">
      <button
        ref={triggerRef}
        type="button"
        className={`sonr-menu-trigger sonr-icon-trigger${open ? " open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Candle type: ${current?.label ?? "Candles"}`}
        title={`Candle type: ${current?.label ?? "Candles"}`}
        onClick={toggleOpen}
      >
        <CandleIcon />
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
            aria-label="Candle type"
            style={{ position: "fixed", top: pos.top, left: pos.left }}
          >
            {options.map((opt) => {
              const on = opt.style === value;
              return (
                <button
                  key={opt.style}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  className={`sonr-menu-option${on ? " on" : ""}`}
                  onClick={() => pick(opt.style)}
                >
                  <span className="sonr-menu-check" aria-hidden>
                    {on ? "✓" : ""}
                  </span>
                  <span className="sonr-menu-label sonr-menu-label-wide">{opt.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

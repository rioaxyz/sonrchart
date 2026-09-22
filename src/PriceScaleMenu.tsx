import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { PriceScale } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";
import { useDropdown } from "./useDropdown";

// A single-select dropdown for the price-scale type (#12), driven by props (the
// host owns the value and passes it to both <SonrChart priceScale> and here).
// Scale type is fixed at chart init, so changing it re-inits the chart — that's
// the host's concern; this control just reports the new value.

type ScaleType = NonNullable<PriceScale["type"]>;

const SCALE_LABELS: Record<ScaleType, string> = {
  normal: "Normal",
  logarithm: "Logarithmic",
  percentage: "Percent",
};
const SCALE_ORDER: ScaleType[] = ["normal", "logarithm", "percentage"];

export function PriceScaleMenu({
  value,
  onChange,
  className,
}: {
  value?: PriceScale;
  onChange?: (scale: PriceScale) => void;
  className?: string;
}) {
  useEffect(ensureDefaultStyles, []);

  const { open, setOpen, toggle: toggleOpen, pos, triggerRef, panelRef } = useDropdown();
  const type = (value?.type ?? "normal") as ScaleType;

  const pick = (t: ScaleType) => {
    onChange?.({ ...value, type: t });
    setOpen(false);
  };

  return (
    <div className={className ?? "sonr-scale-menu"} role="group" aria-label="Price scale">
      <button
        ref={triggerRef}
        type="button"
        className={`sonr-menu-trigger${open ? " open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Price scale"
        onClick={toggleOpen}
      >
        Scale: {SCALE_LABELS[type]}
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
            aria-label="Price scale"
            style={{ position: "fixed", top: pos.top, left: pos.left }}
          >
            {SCALE_ORDER.map((t) => {
              const on = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  className={`sonr-menu-option${on ? " on" : ""}`}
                  onClick={() => pick(t)}
                >
                  <span className="sonr-menu-check" aria-hidden>
                    {on ? "✓" : ""}
                  </span>
                  <span className="sonr-menu-label sonr-menu-label-wide">{SCALE_LABELS[t]}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

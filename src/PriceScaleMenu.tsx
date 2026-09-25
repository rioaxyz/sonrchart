import { useEffect, useMemo, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { PriceLabels, PriceScale } from "./types";
import type { SonrChartHandle } from "./SonrChart";
import { ensureDefaultStyles } from "./defaultStyles";
import { useDropdown } from "./useDropdown";
import { mergeLabels, type Labels } from "./labels";

// Price-scale label toggles (#41), rendered under the scale-type options when a
// chartRef is supplied. Each maps to a Labels key + a boolean field.
const PL_TOGGLES: { key: keyof PriceLabels; label: (L: Labels) => string }[] = [
  { key: "lastValue", label: (L) => L.priceLabelLastValue },
  { key: "lastLine", label: (L) => L.priceLabelLastLine },
  { key: "high", label: (L) => L.priceLabelHigh },
  { key: "low", label: (L) => L.priceLabelLow },
  { key: "countdown", label: (L) => L.priceLabelCountdown },
];

// A single-select dropdown for the price-scale type (#12), driven by props (the
// host owns the value and passes it to both <SonrChart priceScale> and here).
// Scale type is fixed at chart init, so changing it re-inits the chart — that's
// the host's concern; this control just reports the new value.

type ScaleType = NonNullable<PriceScale["type"]>;

const SCALE_ORDER: ScaleType[] = ["normal", "logarithm", "percentage"];

export function PriceScaleMenu({
  value,
  onChange,
  className,
  labels,
  chartRef,
}: {
  value?: PriceScale;
  onChange?: (scale: PriceScale) => void;
  className?: string;
  labels?: Partial<Labels>;
  /** When supplied, renders the price-scale label toggles (#41). */
  chartRef?: RefObject<SonrChartHandle>;
}) {
  useEffect(ensureDefaultStyles, []);

  const L = useMemo(() => mergeLabels(labels), [labels]);
  const { open, setOpen, toggle: toggleOpen, pos, triggerRef, panelRef } = useDropdown();
  const type = (value?.type ?? "normal") as ScaleType;

  const pick = (t: ScaleType) => {
    onChange?.({ ...value, type: t });
    setOpen(false);
  };

  // Mirror the chart's price-label toggles (seed + subscribe once attached).
  const [priceLabels, setPriceLabels] = useState<Required<PriceLabels>>({ lastValue: true, lastLine: true, high: true, low: true, countdown: false });
  useEffect(() => {
    if (!chartRef) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    const attach = () => {
      if (cancelled) return;
      const h = chartRef.current;
      if (h?.getPriceLabels) {
        const sync = () => setPriceLabels(h.getPriceLabels());
        sync();
        unsub = h.subscribePriceLabels?.(sync);
      } else {
        setTimeout(attach, 50);
      }
    };
    attach();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [chartRef]);

  const toggleLabel = (key: keyof PriceLabels, on: boolean) => {
    const next: Partial<PriceLabels> = {};
    next[key] = !on;
    chartRef?.current?.setPriceLabels?.(next);
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
        {L.scale}: {L.scaleTypes[type]}
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
                  <span className="sonr-menu-label sonr-menu-label-wide">{L.scaleTypes[t]}</span>
                </button>
              );
            })}
            {chartRef && (
              <>
                <div className="sonr-menu-sep" role="separator" />
                <div className="sonr-menu-subhead">{L.priceLabelsHeading}</div>
                {PL_TOGGLES.map(({ key, label }) => {
                  const on = priceLabels[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={on}
                      className={`sonr-menu-option${on ? " on" : ""}`}
                      onClick={() => toggleLabel(key, on)}
                    >
                      <span className="sonr-menu-check" aria-hidden>
                        {on ? "✓" : ""}
                      </span>
                      <span className="sonr-menu-label sonr-menu-label-wide">{label(L)}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

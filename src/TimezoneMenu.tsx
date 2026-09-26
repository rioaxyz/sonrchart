import { useEffect, useMemo, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { SonrChartHandle } from "./SonrChart";
import { ensureDefaultStyles } from "./defaultStyles";
import { useDropdown } from "./useDropdown";
import { mergeLabels, type Labels } from "./labels";
import { DEFAULT_TIMEZONE, DEFAULT_TIMEZONES, timezoneLabel, type TimezoneOption } from "./timezone";

// Timezone picker (issue #38). Single-select dropdown mirroring PriceScaleMenu.
// Handle-driven (uncontrolled): it seeds from and subscribes to the chart's
// timezone via the ref, and applies changes with setTimezone — so a host wires
// it with just a chartRef, matching the theme/candle-style controls. The
// `timezone` prop on <SonrChart> still overrides.

export function TimezoneMenu({
  chartRef,
  options = DEFAULT_TIMEZONES,
  className,
  labels,
}: {
  chartRef: RefObject<SonrChartHandle>;
  /** Timezones to offer (defaults to the curated common set). */
  options?: TimezoneOption[];
  className?: string;
  labels?: Partial<Labels>;
}) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);
  const { open, setOpen, toggle: toggleOpen, pos, triggerRef, panelRef } = useDropdown();

  const [tz, setTz] = useState<string>(DEFAULT_TIMEZONE);
  // Seed + subscribe once the handle is attached (mirrors PriceScaleMenu).
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    const attach = () => {
      if (cancelled) return;
      const h = chartRef.current;
      if (h?.getTimezone) {
        const sync = () => setTz(h.getTimezone());
        sync();
        unsub = h.subscribeTimezone?.(sync);
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

  const pick = (value: string) => {
    chartRef.current?.setTimezone?.(value);
    setOpen(false);
  };

  return (
    <div className={className ?? "sonr-tz-menu"} role="group" aria-label={L.timezone}>
      <button
        ref={triggerRef}
        type="button"
        className={`sonr-menu-trigger${open ? " open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={L.timezone}
        title={L.timezone}
        onClick={toggleOpen}
      >
        {timezoneLabel(tz, options)}
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
            aria-label={L.timezone}
            style={{ position: "fixed", top: pos.top, left: pos.left }}
          >
            {options.map((o) => {
              const on = o.value === tz;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  className={`sonr-menu-option${on ? " on" : ""}`}
                  onClick={() => pick(o.value)}
                >
                  <span className="sonr-menu-check" aria-hidden>
                    {on ? "✓" : ""}
                  </span>
                  <span className="sonr-menu-label sonr-menu-label-wide">{o.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

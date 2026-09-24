import { useEffect, useMemo, useState, type RefObject } from "react";
import type { SonrChartHandle } from "./SonrChart";
import type { IndicatorRow } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";
import { EyeIcon, EyeOffIcon, ClearIcon } from "./icons";
import { mergeLabels, type Labels } from "./labels";

// Data-window panel (issue #45): a compact list of the active user indicators
// with a per-row show/hide eye and a remove button. Driven entirely by the
// chart handle and refreshed from a subscription (indicator add/remove/
// visibility) — it never touches the per-frame render path.

export function DataWindow({
  chartRef,
  className,
  labels,
}: {
  chartRef: RefObject<SonrChartHandle>;
  className?: string;
  labels?: Partial<Labels>;
}) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);
  const [rows, setRows] = useState<IndicatorRow[]>([]);

  // The handle mounts as a sibling, so retry until it's available, then seed +
  // subscribe. Any indicator change re-reads the list (cheap, not per-frame).
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    const attach = () => {
      if (cancelled) return;
      const h = chartRef.current;
      if (h?.listIndicatorRows) {
        const sync = () => setRows(h.listIndicatorRows());
        sync();
        unsub = h.subscribeIndicators?.(sync);
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

  return (
    <div className={className ?? "sonr-panel"} role="group" aria-label={L.dataWindow}>
      <div className="sonr-panel-title">{L.dataWindow}</div>
      {rows.length === 0 ? (
        <div className="sonr-panel-empty">{L.noIndicators}</div>
      ) : (
        <ul className="sonr-panel-list">
          {rows.map((row) => (
            <li key={row.name} className={`sonr-panel-row${row.visible ? "" : " off"}`}>
              <span className="sonr-panel-label" title={row.name}>
                {row.name}
              </span>
              <span className="sonr-panel-actions">
                <button
                  type="button"
                  className="sonr-panel-btn"
                  aria-pressed={!row.visible}
                  title={row.visible ? L.hide : L.show}
                  aria-label={`${row.visible ? L.hide : L.show}: ${row.name}`}
                  onClick={() => chartRef.current?.setIndicatorVisible?.(row.name, !row.visible)}
                >
                  {row.visible ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                <button
                  type="button"
                  className="sonr-panel-btn sonr-panel-remove"
                  title={L.remove}
                  aria-label={`${L.remove}: ${row.name}`}
                  onClick={() => chartRef.current?.removeIndicator?.(row.name)}
                >
                  <ClearIcon />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

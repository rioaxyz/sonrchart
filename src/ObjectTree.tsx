import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import type { SonrChartHandle } from "./SonrChart";
import type { DrawingRow } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";
import { EyeIcon, EyeOffIcon, LockIcon, UnlockIcon, ClearIcon } from "./icons";
import { mergeLabels, type Labels } from "./labels";

// Object-tree panel (issue #45): lists every user drawing with a per-row label
// (a text label shows its own content), a show/hide eye, a lock toggle, and a
// remove button. Refreshed from the drawing-history subscription (add/remove/
// undo/redo/clear all push a history step) plus a re-read after each per-row
// action, so it stays in sync without polling or per-frame work.

export function ObjectTree({
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
  const [rows, setRows] = useState<DrawingRow[]>([]);

  const refresh = useCallback(() => {
    const h = chartRef.current;
    if (h?.listDrawings) setRows(h.listDrawings());
  }, [chartRef]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    const attach = () => {
      if (cancelled) return;
      const h = chartRef.current;
      if (h?.listDrawings) {
        refresh();
        // History changes cover create / remove / clear / undo / redo.
        unsub = h.subscribeHistory?.(refresh);
      } else {
        setTimeout(attach, 50);
      }
    };
    attach();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [chartRef, refresh]);

  return (
    <div className={className ?? "sonr-panel"} role="group" aria-label={L.objectTree}>
      <div className="sonr-panel-title">{L.objectTree}</div>
      {rows.length === 0 ? (
        <div className="sonr-panel-empty">{L.noDrawings}</div>
      ) : (
        <ul className="sonr-panel-list">
          {rows.map((row) => (
            <li key={row.id} className={`sonr-panel-row${row.visible ? "" : " off"}`}>
              <span className="sonr-panel-label" title={row.label}>
                {row.label}
              </span>
              <span className="sonr-panel-actions">
                <button
                  type="button"
                  className="sonr-panel-btn"
                  aria-pressed={row.locked}
                  title={row.locked ? L.unlock : L.lock}
                  aria-label={`${row.locked ? L.unlock : L.lock}: ${row.label}`}
                  onClick={() => {
                    chartRef.current?.setDrawingLocked?.(row.id, !row.locked);
                    refresh();
                  }}
                >
                  {row.locked ? <LockIcon /> : <UnlockIcon />}
                </button>
                <button
                  type="button"
                  className="sonr-panel-btn"
                  aria-pressed={!row.visible}
                  title={row.visible ? L.hide : L.show}
                  aria-label={`${row.visible ? L.hide : L.show}: ${row.label}`}
                  onClick={() => {
                    chartRef.current?.setDrawingVisible?.(row.id, !row.visible);
                    refresh();
                  }}
                >
                  {row.visible ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                <button
                  type="button"
                  className="sonr-panel-btn sonr-panel-remove"
                  title={L.remove}
                  aria-label={`${L.remove}: ${row.label}`}
                  onClick={() => chartRef.current?.removeDrawing?.(row.id)}
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

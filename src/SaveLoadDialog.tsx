import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { SonrChartHandle } from "./SonrChart";
import type { ChartState } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";
import { mergeLabels, type Labels } from "./labels";

// Save / Load dialog for chart state (issue #15). A portal dialog (modeled on
// ConfirmDialog) with two textareas: the top one shows the current chart state
// as pretty-printed JSON with a Copy button (and an optional Download), and the
// bottom one takes pasted JSON that a Load button validates and hands to
// importState. Escape or an overlay click closes; parse/shape errors surface
// inline and never call importState. Class-based styling (`.sonr-sl-*`) with
// neutral defaults injected by ensureDefaultStyles.

// A user-defined type guard that narrows unknown JSON to ChartState using only
// runtime checks (no `as` casts): the `in` operator narrows the object so its
// fields can be read as `unknown`. importState is itself defensive about the
// rest of the shape, so gating on `version === 1` is enough to reject unrelated
// JSON while accepting any state this library produced.
export function isChartState(value: unknown): value is ChartState {
  if (typeof value !== "object" || value === null) return false;
  if (!("version" in value)) return false;
  return value.version === 1;
}

export function SaveLoadDialog({
  chartRef,
  open,
  onClose,
  labels,
}: {
  chartRef: RefObject<SonrChartHandle>;
  open: boolean;
  onClose: () => void;
  labels?: Partial<Labels>;
}) {
  useEffect(ensureDefaultStyles, []);
  const L = mergeLabels(labels);
  const copyRef = useRef<HTMLButtonElement>(null);
  const [exported, setExported] = useState("");
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Read the live state each time the dialog opens; reset the paste side.
  useEffect(() => {
    if (!open) return;
    const state = chartRef.current?.exportState?.();
    setExported(state ? JSON.stringify(state, null, 2) : "");
    setPasted("");
    setError(null);
    setCopied(false);
    copyRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, chartRef, onClose]);

  const onCopy = useCallback(() => {
    void navigator.clipboard?.writeText?.(exported);
    setCopied(true);
  }, [exported]);

  const onDownload = useCallback(() => {
    if (typeof URL === "undefined" || !URL.createObjectURL) return;
    const blob = new Blob([exported], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chart-state.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [exported]);

  const onLoad = useCallback(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(pasted);
    } catch {
      setError(L.saveLoadError ?? "Invalid JSON — could not load.");
      return;
    }
    if (!isChartState(parsed)) {
      setError(L.saveLoadError ?? "Invalid JSON — could not load.");
      return;
    }
    setError(null);
    chartRef.current?.importState?.(parsed);
    onClose();
  }, [pasted, chartRef, onClose, L.saveLoadError]);

  if (!open || typeof document === "undefined") return null;

  const title = L.saveLoad ?? "Save / Load";

  return createPortal(
    <div className="sonr-sl-overlay" onMouseDown={onClose}>
      <div
        className="sonr-sl-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sonr-sl-head">
          <span className="sonr-sl-title">{title}</span>
          <button
            type="button"
            className="sonr-sl-close"
            aria-label={L.saveLoadClose ?? "Close"}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="sonr-sl-body">
          <section className="sonr-sl-section">
            <div className="sonr-sl-section-head">
              <label className="sonr-sl-label" htmlFor="sonr-sl-export">
                {L.saveLoadExportLabel ?? "Current chart state"}
              </label>
              <span className="sonr-sl-section-actions">
                <button ref={copyRef} type="button" className="sonr-sl-btn" onClick={onCopy}>
                  {copied ? L.saveLoadCopied ?? "Copied" : L.saveLoadCopy ?? "Copy"}
                </button>
                <button type="button" className="sonr-sl-btn" onClick={onDownload}>
                  {L.saveLoadDownload ?? "Download"}
                </button>
              </span>
            </div>
            <textarea
              id="sonr-sl-export"
              className="sonr-sl-textarea"
              readOnly
              spellCheck={false}
              value={exported}
              aria-label={L.saveLoadExportLabel ?? "Current chart state"}
            />
          </section>
          <section className="sonr-sl-section">
            <label className="sonr-sl-label" htmlFor="sonr-sl-import">
              {L.saveLoadImportLabel ?? "Paste chart state to load"}
            </label>
            <textarea
              id="sonr-sl-import"
              className="sonr-sl-textarea"
              spellCheck={false}
              value={pasted}
              placeholder="{ ... }"
              aria-label={L.saveLoadImportLabel ?? "Paste chart state to load"}
              onChange={(e) => {
                setPasted(e.target.value);
                if (error) setError(null);
              }}
            />
            {error && (
              <p className="sonr-sl-error" role="alert">
                {error}
              </p>
            )}
            <div className="sonr-sl-actions">
              <button type="button" className="sonr-sl-btn sonr-sl-load" onClick={onLoad}>
                {L.saveLoadLoad ?? "Load"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

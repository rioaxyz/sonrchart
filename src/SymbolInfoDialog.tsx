import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import type { DataSource, SymbolInfo } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";
import { mergeLabels, type Labels } from "./labels";

// Symbol-info dialog (issue #45). A small portal dialog that shows the resolved
// metadata for the current symbol: ticker, name, and price/volume precision.
// On open it calls dataSource.resolveSymbol (issue #8) and renders the fields in
// a definition list; a null result reads "Unknown symbol", and when the datafeed
// has no resolveSymbol at all it just shows the raw ticker. The async resolve is
// guarded against close and against a superseding symbol via a request id, so a
// slow earlier response can't overwrite a newer one or paint after close.
//
// Modelled on ConfirmDialog / SettingsModal: body-portaled so it escapes any
// overflow clip, Escape or an overlay click closes, the close button is focused
// on open, and every class is `sonr-`-prefixed with neutral defaults injected by
// ensureDefaultStyles so a host theme can override them.

/** Internal render phase — a small discriminated state so the four outcomes
 *  (loading, resolved, unknown, raw) each render exactly one branch. */
type Phase =
  | { kind: "loading" }
  | { kind: "resolved"; info: SymbolInfo }
  | { kind: "unknown" }
  | { kind: "raw" };

export function SymbolInfoDialog({
  dataSource,
  symbol,
  open,
  onClose,
  labels,
}: {
  dataSource: DataSource;
  symbol: string;
  open: boolean;
  onClose: () => void;
  labels?: Partial<Labels>;
}) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reqId = useRef(0);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  // Resolve on open (and whenever the symbol changes while open). Stale/late
  // responses are dropped via reqId, and the local `cancelled` flag stops a
  // pending promise from painting after unmount/close.
  useEffect(() => {
    if (!open) return;
    const resolve = dataSource.resolveSymbol;
    if (typeof resolve !== "function") {
      setPhase({ kind: "raw" });
      return;
    }
    const id = ++reqId.current;
    let cancelled = false;
    setPhase({ kind: "loading" });
    resolve(symbol)
      .then((res) => {
        if (cancelled || id !== reqId.current) return;
        setPhase(res ? { kind: "resolved", info: res } : { kind: "unknown" });
      })
      .catch(() => {
        if (cancelled || id !== reqId.current) return;
        setPhase({ kind: "unknown" });
      });
    return () => {
      cancelled = true;
    };
  }, [open, symbol, dataSource]);

  // Focus the close button on open; Escape closes (captured so it beats any
  // host-level key handling, matching ConfirmDialog).
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const title = L.symbolInfo ?? "Symbol info";
  const tickerLabel = L.symbolInfoTicker ?? "Ticker";
  const nameLabel = L.symbolInfoName ?? "Name";
  const priceLabel = L.symbolInfoPricePrecision ?? "Price precision";
  const volLabel = L.symbolInfoVolumePrecision ?? "Volume precision";
  const unknownMsg = L.symbolInfoUnknown ?? "Unknown symbol";
  const loadingMsg = L.symbolInfoLoading ?? "Loading…";
  const closeLabel = L.close ?? "Close";

  const renderInfo = (info: SymbolInfo) => (
    <dl className="sonr-syminfo-dl">
      <dt className="sonr-syminfo-dt">{tickerLabel}</dt>
      <dd className="sonr-syminfo-dd">{info.ticker}</dd>
      {info.name !== undefined && info.name !== "" && (
        <>
          <dt className="sonr-syminfo-dt">{nameLabel}</dt>
          <dd className="sonr-syminfo-dd">{info.name}</dd>
        </>
      )}
      {typeof info.pricePrecision === "number" && (
        <>
          <dt className="sonr-syminfo-dt">{priceLabel}</dt>
          <dd className="sonr-syminfo-dd">{info.pricePrecision}</dd>
        </>
      )}
      {typeof info.volumePrecision === "number" && (
        <>
          <dt className="sonr-syminfo-dt">{volLabel}</dt>
          <dd className="sonr-syminfo-dd">{info.volumePrecision}</dd>
        </>
      )}
    </dl>
  );

  let body: React.ReactNode;
  if (phase.kind === "loading") {
    body = (
      <div className="sonr-syminfo-msg" role="status">
        {loadingMsg}
      </div>
    );
  } else if (phase.kind === "unknown") {
    body = (
      <div className="sonr-syminfo-msg" role="status">
        {unknownMsg}
      </div>
    );
  } else if (phase.kind === "raw") {
    body = renderInfo({ ticker: symbol });
  } else {
    body = renderInfo(phase.info);
  }

  return createPortal(
    <div className="sonr-syminfo-overlay" onMouseDown={onClose}>
      <div
        className="sonr-syminfo"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sonr-syminfo-head">
          <span className="sonr-syminfo-title">{title}</span>
          <button
            ref={closeRef}
            type="button"
            className="sonr-syminfo-close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="sonr-syminfo-body">{body}</div>
      </div>
    </div>,
    document.body,
  );
}

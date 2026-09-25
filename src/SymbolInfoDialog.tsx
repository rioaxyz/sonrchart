import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import type { DataSource, SymbolInfo } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";
import { etClock, exchangeTimezone } from "./MarketStatus";
import { mergeLabels, type Labels } from "./labels";

// Symbol-info dialog (issue #45), modelled on TradingView's: the instrument's
// reference metadata — ticker + name, then Type / Point value / Listed exchange
// / Exchange / Tick size, and a Session timeline with the exchange timezone. It
// deliberately carries no live price (that's on the chart). Ticker/name/tick
// size come from dataSource.resolveSymbol; the rest are host-supplied props with
// US-equity defaults. Body-portaled; Escape / overlay-click closes.

// Extended US-equities session window (04:00–20:00 ET) drawn on a 24h day.
const DAY = 24 * 60;
const EXT_OPEN = 4 * 60;
const EXT_CLOSE = 20 * 60;

export function SymbolInfoDialog({
  dataSource,
  symbol,
  open,
  onClose,
  labels,
  type = "Stock",
  exchange = "—",
  listedExchange = "—",
  pointValue = 1,
  tickSize,
  now,
}: {
  dataSource: DataSource;
  symbol: string;
  open: boolean;
  onClose: () => void;
  labels?: Partial<Labels>;
  /** Instrument type (default "Stock"). */
  type?: string;
  /** Trading venue label (e.g. "Alpaca"). */
  exchange?: string;
  /** Primary listing exchange, if known (default "—"). */
  listedExchange?: string;
  /** Contract point value (default 1 for cash equities). */
  pointValue?: number;
  /** Minimum price increment. Defaults to 10^-pricePrecision from resolveSymbol. */
  tickSize?: number;
  /** Fixed instant for the session timeline (defaults to the live clock). */
  now?: number;
}) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reqId = useRef(0);
  const [info, setInfo] = useState<SymbolInfo | null>(null);

  // Resolve on open; stale/late responses dropped via reqId + a cancel flag.
  useEffect(() => {
    if (!open) return;
    const resolve = dataSource.resolveSymbol;
    setInfo(null);
    if (typeof resolve !== "function") {
      setInfo({ ticker: symbol });
      return;
    }
    const id = ++reqId.current;
    let cancelled = false;
    resolve(symbol)
      .then((res) => {
        if (cancelled || id !== reqId.current) return;
        setInfo(res ?? { ticker: symbol });
      })
      .catch(() => {
        if (cancelled || id !== reqId.current) return;
        setInfo({ ticker: symbol });
      });
    return () => {
      cancelled = true;
    };
  }, [open, symbol, dataSource]);

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

  const ticker = info?.ticker ?? symbol;
  const name = info?.name;
  const prec = info?.pricePrecision ?? 2;
  const tick = tickSize ?? 1 / 10 ** prec;
  const tickText = tick.toFixed(Math.max(prec, 1));

  const at = now ?? Date.now();
  const { weekday, minutesOfDay } = etClock(at);
  const pct = (m: number) => `${((m / DAY) * 100).toFixed(2)}%`;

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="sonr-syminfo-field">
      <div className="sonr-syminfo-flabel">{label}</div>
      <div className="sonr-syminfo-fvalue">{value}</div>
    </div>
  );

  return createPortal(
    <div className="sonr-syminfo-overlay" onMouseDown={onClose}>
      <div className="sonr-syminfo" role="dialog" aria-modal="true" aria-label={L.symbolInfo} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sonr-syminfo-head">
          <span className="sonr-syminfo-title">{L.symbolInfo}</span>
          <button ref={closeRef} type="button" className="sonr-syminfo-close" aria-label={L.close} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sonr-syminfo-body">
          {info === null ? (
            <div className="sonr-syminfo-msg" role="status">
              {L.symbolInfoLoading}
            </div>
          ) : (
            <>
              <div className="sonr-syminfo-sym">
                <span className="sonr-syminfo-ticker">{ticker}</span>
                {name ? <span className="sonr-syminfo-name">{name}</span> : null}
              </div>
              <div className="sonr-syminfo-grid">
                <Field label={L.symbolInfoType} value={type} />
                <Field label={L.symbolInfoPointValue} value={pointValue} />
                <Field label={L.symbolInfoListedExchange} value={listedExchange} />
                <Field label={L.symbolInfoExchange} value={exchange} />
                <Field label={L.symbolInfoTickSize} value={tickText} />
              </div>
              <div className="sonr-syminfo-session">
                <div className="sonr-syminfo-flabel">{L.symbolInfoSession}</div>
                <div className="sonr-syminfo-timeline">
                  <span className="sonr-syminfo-day">{(weekday || "").toUpperCase()}</span>
                  <div className="sonr-syminfo-track">
                    <div className="sonr-syminfo-band" style={{ left: pct(EXT_OPEN), width: pct(EXT_CLOSE - EXT_OPEN) }} />
                    <div className="sonr-syminfo-now" style={{ left: pct(minutesOfDay) }} />
                  </div>
                  <div className="sonr-syminfo-ticks">
                    <span>00:00</span>
                    <span>12:00</span>
                    <span>24:00</span>
                  </div>
                </div>
                <div className="sonr-syminfo-tz">
                  {L.marketTimezone}: {exchangeTimezone(at)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

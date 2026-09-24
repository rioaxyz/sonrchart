import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataSource, Interval, SymbolSearchResult } from "./types";
import { mergeLabels, type Labels } from "./labels";
import { ensureDefaultStyles } from "./defaultStyles";
import { ClearIcon } from "./icons";

// Watchlist (issue #45): a right-panel list of symbols the user tracks. Each row
// shows the ticker, its last price, and the session % change (green up / red
// down — a red/green SEMANTIC pair, deliberately not the chart accent). An
// add-input searches the DataSource as you type (debounced, stale-guarded like
// SymbolSearch) and appends the picked ticker; a per-row × drops it; a row click
// calls onSelect so the host can re-point the chart. Quotes come straight from
// dataSource.getBars(symbol, interval, 2) and re-fetch when the interval changes.
// Every async result is guarded by a request id + cancel flag so an unmount or a
// superseding fetch never lands on stale state.

/** One resolved quote: the last close and the fractional change vs. the prior
 *  bar (0.012 = +1.2%). */
interface Quote {
  last: number;
  change: number;
}

export interface WatchlistProps {
  dataSource: DataSource;
  interval: Interval;
  /** Seed tickers for the internal list. Read once on mount. */
  symbols?: string[];
  onSelect?: (symbol: string) => void;
  labels?: Partial<Labels>;
  className?: string;
}

// English fallbacks for label keys not yet in Labels; listed in labelKeys so the
// lead adds them (then L.<key> resolves through mergeLabels). The `?? fallback`
// keeps the component correct before that wiring lands.
const FALLBACK = {
  watchlist: "Watchlist",
  addSymbol: "Add symbol",
  emptyWatchlist: "No symbols yet",
  searchUnavailable: "Search unavailable",
  searching: "Searching…",
  noResults: "No results",
} as const;

/** Format a fractional change as a signed percent, e.g. 0.0123 → "+1.23%". */
export function formatChange(change: number): string {
  const pct = change * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/** Pick the semantic direction class suffix for a change. */
function direction(change: number): "up" | "down" | "flat" {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

export function Watchlist({ dataSource, interval, symbols, onSelect, labels, className }: WatchlistProps) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);

  const [list, setList] = useState<string[]>(() => (symbols ? [...symbols] : []));
  const [quotes, setQuotes] = useState<Record<string, Quote | undefined>>({});

  // Add-input search state, mirroring SymbolSearch's debounce + reqId guard.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const searchReq = useRef(0);
  const quoteReq = useRef(0);

  const canSearch = typeof dataSource.searchSymbols === "function";

  // Fetch last price + % change for each row; re-runs when the list, interval, or
  // datasource changes. A per-run id + cancel flag drop stale/late responses.
  useEffect(() => {
    let cancelled = false;
    const id = ++quoteReq.current;
    for (const sym of list) {
      void (async () => {
        try {
          const bars = await dataSource.getBars(sym, interval, 2);
          if (cancelled || id !== quoteReq.current) return;
          if (bars.length >= 2) {
            const last = bars[bars.length - 1].close;
            const prev = bars[bars.length - 2].close;
            const change = prev !== 0 ? (last - prev) / prev : 0;
            setQuotes((q) => ({ ...q, [sym]: { last, change } }));
          } else if (bars.length === 1) {
            setQuotes((q) => ({ ...q, [sym]: { last: bars[0].close, change: 0 } }));
          } else {
            setQuotes((q) => ({ ...q, [sym]: undefined }));
          }
        } catch {
          if (cancelled || id !== quoteReq.current) return;
          setQuotes((q) => ({ ...q, [sym]: undefined }));
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [list, interval, dataSource]);

  // Debounced symbol search for the add-input. Stale responses dropped via reqId.
  useEffect(() => {
    const q = query.trim();
    if (!q || !canSearch) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++searchReq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const hits = (await dataSource.searchSymbols!(q)) ?? [];
        if (id === searchReq.current) setResults(hits);
      } catch {
        if (id === searchReq.current) setResults([]);
      } finally {
        if (id === searchReq.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, canSearch, dataSource]);

  const add = useCallback((symbol: string) => {
    const s = symbol.trim();
    if (!s) return;
    setList((cur) => (cur.includes(s) ? cur : [...cur, s]));
    setQuery("");
    setResults([]);
    setOpen(false);
  }, []);

  const remove = useCallback((symbol: string) => {
    setList((cur) => cur.filter((x) => x !== symbol));
    setQuotes((q) => {
      const next = { ...q };
      delete next[symbol];
      return next;
    });
  }, []);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (results[0]) add(results[0].symbol);
      else if (query.trim()) add(query.trim());
    }
  };

  const showPanel = open && query.trim().length > 0;
  const title = L.watchlist ?? FALLBACK.watchlist;
  const addLabel = L.addSymbol ?? FALLBACK.addSymbol;

  return (
    <div className={className ?? "sonr-watchlist"} role="group" aria-label={title}>
      <div className="sonr-panel-title">{title}</div>
      <div className="sonr-watchlist-add">
        <input
          type="text"
          className="sonr-search-input"
          role="combobox"
          aria-expanded={showPanel}
          aria-autocomplete="list"
          aria-label={addLabel}
          placeholder={addLabel}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
        />
        {showPanel && (
          <div className="sonr-watchlist-results" role="listbox" aria-label={addLabel}>
            {canSearch === false && (
              <div className="sonr-search-msg" role="presentation">
                {L.searchUnavailable ?? FALLBACK.searchUnavailable}
              </div>
            )}
            {canSearch && loading && results.length === 0 && (
              <div className="sonr-search-msg" role="presentation">
                {L.searching ?? FALLBACK.searching}
              </div>
            )}
            {canSearch && !loading && results.length === 0 && (
              <div className="sonr-search-msg" role="presentation">
                {L.noResults ?? FALLBACK.noResults}
              </div>
            )}
            {results.map((r, i) => (
              <button
                key={`${r.symbol}-${i}`}
                type="button"
                role="option"
                aria-selected={false}
                className="sonr-search-option"
                onClick={() => add(r.symbol)}
              >
                <span className="sonr-search-sym">{r.symbol}</span>
                {(r.name || r.exchange) && (
                  <span className="sonr-search-name">{r.name ?? r.exchange}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <div className="sonr-panel-empty">{L.emptyWatchlist ?? FALLBACK.emptyWatchlist}</div>
      ) : (
        <ul className="sonr-panel-list sonr-watchlist-list">
          {list.map((sym) => {
            const q = quotes[sym];
            const dir = q ? direction(q.change) : "flat";
            return (
              <li key={sym} className="sonr-watchlist-row">
                <button
                  type="button"
                  className="sonr-watchlist-pick"
                  onClick={() => onSelect?.(sym)}
                >
                  <span className="sonr-watchlist-sym">{sym}</span>
                  <span className="sonr-watchlist-quote">
                    <span className="sonr-watchlist-last">{q ? q.last.toFixed(2) : "—"}</span>
                    <span className={`sonr-watchlist-chg sonr-watchlist-chg-${dir}`}>
                      {q ? formatChange(q.change) : ""}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="sonr-panel-btn sonr-watchlist-remove"
                  title={L.remove}
                  aria-label={`${L.remove}: ${sym}`}
                  onClick={() => remove(sym)}
                >
                  <ClearIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

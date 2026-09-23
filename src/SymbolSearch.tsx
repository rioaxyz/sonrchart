import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DataSource, SymbolSearchResult } from "./types";
import { ensureDefaultStyles } from "./defaultStyles";

// Symbol-search dialog (issue #37). A text input that searches the DataSource
// as the user types (debounced) and shows a body-portaled dropdown of hits.
// Selecting one calls onSelect(symbol) — the host then re-points the chart's
// `symbol` prop. The panel is portaled so it isn't clipped by the toolbar's
// overflow, matching IndicatorMenu / PriceScaleMenu.
//
// When `spreadOperators` is on and the query looks like an expression
// (AAPL/MSFT, SPY*2, 1/x), a synthetic "Use expression" row lets the raw string
// through as a symbol; resolving/charting the spread is the datafeed's job.

/** True when the query contains an arithmetic operator between two operands,
 *  i.e. it reads as a spread/expression rather than a plain ticker. */
export function isSpreadExpression(query: string): boolean {
  return /\S\s*[/*+\-^]\s*\S/.test(query.trim());
}

export function SymbolSearch({
  dataSource,
  onSelect,
  spreadOperators = true,
  placeholder = "Search symbol…",
  className,
}: {
  dataSource: DataSource;
  onSelect: (symbol: string) => void;
  spreadOperators?: boolean;
  placeholder?: string;
  className?: string;
}) {
  useEffect(ensureDefaultStyles, []);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const canSearch = typeof dataSource.searchSymbols === "function";
  const expr = spreadOperators && isSpreadExpression(query);

  const place = useCallback(() => {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  // Debounced search on the query. Stale responses are dropped via reqId so a
  // slow earlier request can't overwrite a newer one.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (!canSearch) return;
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const hits = (await dataSource.searchSymbols!(q)) ?? [];
        if (id === reqId.current) {
          setResults(hits);
          setHighlight(0);
        }
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, canSearch, dataSource]);

  // Outside-click / reposition wiring while open, mirroring useDropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || inputRef.current?.contains(t)) return;
      setOpen(false);
    };
    const reflow = () => place();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", reflow);
    window.addEventListener("scroll", reflow, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow, true);
    };
  }, [open, place]);

  const choose = useCallback(
    (symbol: string) => {
      onSelect(symbol);
      setQuery("");
      setResults([]);
      setOpen(false);
      setHighlight(0);
    },
    [onSelect],
  );

  // The synthetic expression row sits at index 0 when active; result indices
  // shift by 1 so keyboard navigation lines up with what's rendered.
  const exprOffset = expr ? 1 : 0;
  const itemCount = exprOffset + results.length;

  const selectAt = (i: number) => {
    if (expr && i === 0) return choose(query.trim());
    const r = results[i - exprOffset];
    if (r) choose(r.symbol);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (itemCount > 0) selectAt(Math.min(highlight, itemCount - 1));
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (itemCount > 0) setHighlight((h) => (h + 1) % itemCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (itemCount > 0) setHighlight((h) => (h - 1 + itemCount) % itemCount);
    }
  };

  // Once open with a non-empty query there's always something to show — a hit
  // list, the expression row, a loading/empty note, or the unavailable note.
  const showPanel = open && query.trim().length > 0;

  return (
    <div className={className ?? "sonr-search"} role="group" aria-label="Symbol search">
      <input
        ref={inputRef}
        type="text"
        className="sonr-search-input"
        role="combobox"
        aria-expanded={showPanel}
        aria-autocomplete="list"
        aria-label="Search symbol"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          place();
          setOpen(true);
        }}
        onFocus={() => {
          place();
          if (query.trim()) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {showPanel &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="sonr-search-dropdown"
            role="listbox"
            aria-label="Symbol results"
            style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: pos.width }}
          >
            {expr && (
              <button
                type="button"
                role="option"
                aria-selected={highlight === 0}
                className={`sonr-search-option sonr-search-expr${highlight === 0 ? " active" : ""}`}
                onMouseEnter={() => setHighlight(0)}
                onClick={() => choose(query.trim())}
              >
                <span className="sonr-search-sym">Use expression:</span>
                <span className="sonr-search-name">{query.trim()}</span>
              </button>
            )}
            {canSearch === false && (
              <div className="sonr-search-msg" role="presentation">
                Search unavailable
              </div>
            )}
            {canSearch && loading && results.length === 0 && (
              <div className="sonr-search-msg" role="presentation">
                Searching…
              </div>
            )}
            {canSearch && !loading && results.length === 0 && !expr && (
              <div className="sonr-search-msg" role="presentation">
                No results
              </div>
            )}
            {results.map((r, i) => {
              const idx = i + exprOffset;
              return (
                <button
                  key={`${r.symbol}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={highlight === idx}
                  className={`sonr-search-option${highlight === idx ? " active" : ""}`}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => choose(r.symbol)}
                >
                  <span className="sonr-search-sym">{r.symbol}</span>
                  {(r.name || r.exchange) && (
                    <span className="sonr-search-name">{r.name ?? r.exchange}</span>
                  )}
                  {r.exchange && r.name && <span className="sonr-search-ex">{r.exchange}</span>}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

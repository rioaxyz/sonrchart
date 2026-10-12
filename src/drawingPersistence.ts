import type { DrawingSnapshot } from "./drawingTemplates";

// Per-symbol drawing persistence (#97). Drawings anchor to absolute
// (timestamp, price) points, so one symbol's set is meaningful at every
// interval of that symbol — and meaningless on any other symbol. A
// DrawingStore therefore keys snapshots by ticker: SonrChart saves the
// outgoing symbol's set at each chart teardown and restores the incoming
// symbol's at init, which carries drawings across interval, scale, and
// Heikin-Ashi switches (same symbol, same set) while giving every ticker its
// own isolated layer.
//
// Scope mirrors indicatorPersistence (#94): each mounted SonrChart owns one
// store, so two chart tiles never share drawings by accident; with a
// `persistenceKey` the store comes from a module-level registry instead and
// survives full unmounts. In-memory only — a host that wants durable storage
// exports snapshots itself (exportState / snapshotDrawings).

/** Drawing snapshots keyed by ticker symbol. */
export class DrawingStore {
  private bySymbol = new Map<string, DrawingSnapshot>();

  /** Record `snap` as `symbol`'s drawing set. An empty set erases the entry —
   *  "no drawings" and "never drew" restore identically (nothing). */
  save(symbol: string, snap: DrawingSnapshot): void {
    if (!symbol) return;
    if (snap.length === 0) this.bySymbol.delete(symbol);
    else this.bySymbol.set(symbol, snap);
  }

  /** The saved set for `symbol`, or null when it has none. */
  load(symbol: string): DrawingSnapshot | null {
    return this.bySymbol.get(symbol) ?? null;
  }

  /** Drop one symbol's set — or every symbol's when omitted. */
  clear(symbol?: string): void {
    if (symbol === undefined) this.bySymbol.clear();
    else this.bySymbol.delete(symbol);
  }

  /** Symbols that currently have a saved set, in insertion order. */
  symbols(): string[] {
    return [...this.bySymbol.keys()];
  }
}

const stores = new Map<string, DrawingStore>();

/** The module-level store for a `persistenceKey` — created on first use, then
 *  stable for the page's lifetime so remounts of that chart tile see it. */
export function drawingStoreFor(key: string): DrawingStore {
  let store = stores.get(key);
  if (!store) {
    store = new DrawingStore();
    stores.set(key, store);
  }
  return store;
}

/** Drop the keyed store for `key` — or all keyed stores when omitted. */
export function clearPersistedDrawings(key?: string): void {
  if (key === undefined) stores.clear();
  else stores.delete(key);
}

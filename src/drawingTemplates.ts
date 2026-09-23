// In-memory store for named drawing templates (issue #35). A template is a
// snapshot of the user-drawing overlays (the same shape SonrChart's
// snapshotDrawings/restoreDrawings and ChartState.drawings use), saved under a
// name so a UI can re-apply a whole drawing set later. Storage is in-memory
// only — a host that wants persistence exports the snapshots itself.
import type { DeepPartial, Nullable, OverlayMode, OverlayStyle, Point } from "klinecharts";

/** One saved overlay in a drawing template — the canonical serialized shape of
 *  a user drawing, shared by ChartState.drawings and SonrChart's snapshot/
 *  restore. Field types mirror KLineChart's `Overlay`, so a snapshot round-trips
 *  straight back into `createOverlay` with no casts. */
export interface DrawingSnapshotItem {
  name: string;
  points: Array<Partial<Point>>;
  styles?: Nullable<DeepPartial<OverlayStyle>>;
  mode?: OverlayMode;
  extendData?: unknown;
}

/** A full drawing template: the user overlays captured at save time. */
export type DrawingSnapshot = DrawingSnapshotItem[];

/** Named-drawing-set store with change subscription (for a settings UI). */
export class DrawingTemplateStore {
  private templates = new Map<string, DrawingSnapshot>();
  private subs = new Set<() => void>();

  /** Save (or overwrite) a named template from a drawing snapshot. */
  save(name: string, snap: DrawingSnapshot): void {
    if (!name) return;
    this.templates.set(name, snap);
    this.notify();
  }

  /** The saved snapshot for a name, or undefined if there is none. */
  get(name: string): DrawingSnapshot | undefined {
    return this.templates.get(name);
  }

  /** Names of all saved templates, in insertion order. */
  list(): string[] {
    return [...this.templates.keys()];
  }

  /** Remove a template. No-op if the name is unknown. */
  delete(name: string): void {
    if (this.templates.delete(name)) this.notify();
  }

  /** Subscribe to list changes (save/delete). Returns an unsubscribe fn. */
  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  private notify(): void {
    this.subs.forEach((cb) => cb());
  }
}

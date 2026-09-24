// The user-drawing subsystem (issues #3/#16/#35), extracted from SonrChart so
// its state — armed tool, undo/redo history, lock/hide flags, named templates,
// and brush styles — lives in one cohesive, testable place. The hook owns the
// refs and returns a referentially-stable API of ref-reading operations, so the
// component's imperative handle can delegate straight to it. It touches the
// chart only through the `chartRef` it is given and the current magnet mode via
// `getMode`, so it stays decoupled from the rest of the component's concerns.
import { useRef, type MutableRefObject } from "react";
import type { Chart, OverlayMode, Point } from "klinecharts";
import { USER_DRAWING_GROUP, drawingLabel } from "./drawings";
import { TEXT_OVERLAY, DEFAULT_TEXT_STYLE, type TextStyle } from "./textOverlay";
import { DrawingTemplateStore, type DrawingSnapshot } from "./drawingTemplates";
import { BRUSH_OVERLAY, brushStyle, isBrushTool, type BrushStyle, type BrushTool } from "./brush";
import type { DrawingRow, DrawingTool, Theme } from "./types";

export interface DrawingsApi {
  /** Start interactive drawing of a tool; honors the current magnet mode. */
  beginDrawing(tool: string): void;
  /** Cancel an armed-but-unplaced drawing (toggle the tool off). */
  cancelDrawing(): void;
  /** The tool currently armed for drawing, or null if none. */
  activeDrawing(): DrawingTool | null;
  /** Subscribe to armed-tool changes. Returns an unsubscribe fn. */
  subscribeDrawing(cb: (tool: DrawingTool | null) => void): () => void;
  /** Remove all user-drawn overlays (records a history step). */
  clearDrawings(): void;
  /** Serialize the current user drawings (points/styles/mode/extendData). */
  snapshotDrawings(): DrawingSnapshot;
  /** Replace the user drawings with a snapshot (used by undo/redo/import). */
  restoreDrawings(snap: DrawingSnapshot): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Subscribe to undo/redo-availability changes. Returns unsubscribe. */
  subscribeHistory(cb: () => void): () => void;
  /** Reset history to an empty baseline (no notify) — for a fresh chart. */
  initHistory(): void;
  /** Reset history to the current drawings as the baseline (no notify) — after
   *  an import where the host re-seeds from a saved state. */
  resetHistoryToCurrent(): void;
  /** Record the current drawings as a new undo step. Used after an out-of-band
   *  edit (e.g. committing typed text into a placed label). */
  recordHistory(): void;
  setDrawingsLocked(locked: boolean): void;
  getDrawingsLocked(): boolean;
  setDrawingsVisible(visible: boolean): void;
  getDrawingsVisible(): boolean;
  /** Subscribe to hide/show-all changes (keeps a toolbar toggle and the
   *  settings panel in sync). Returns unsubscribe. */
  subscribeDrawingsVisible(cb: (visible: boolean) => void): () => void;
  saveDrawingTemplate(name: string): void;
  applyDrawingTemplate(name: string): void;
  listDrawingTemplates(): string[];
  deleteDrawingTemplate(name: string): void;
  subscribeDrawingTemplates(cb: () => void): () => void;
  cloneLastDrawing(): void;
  getBrushStyle(tool: BrushTool): BrushStyle;
  setBrushStyle(tool: BrushTool, style: BrushStyle): void;
  subscribeBrush(cb: () => void): () => void;
  /** Default color/size applied to new text labels. */
  getTextStyle(): TextStyle;
  setTextStyle(style: TextStyle): void;
  subscribeTextStyle(cb: () => void): () => void;
  // Object tree — per-drawing operations (#45) --------------------------------
  /** Snapshot of every user drawing as object-tree rows (id/label/flags). */
  listDrawings(): DrawingRow[];
  /** Show/hide one drawing by id. */
  setDrawingVisible(id: string, visible: boolean): void;
  /** Lock/unlock one drawing by id. */
  setDrawingLocked(id: string, locked: boolean): void;
  /** Remove one drawing by id (records a history step). */
  removeDrawing(id: string): void;
}

type Snap = DrawingSnapshot;

const HISTORY_CAP = 100;

/**
 * @param chartRef  the live KLineChart instance (may be null before init).
 * @param getMode   returns the OverlayMode to arm a new (non-brush) drawing with
 *                  — reads the component's current magnet mode.
 * @param baseTheme dark/light base used to seed the initial brush styles.
 */
export function useDrawings(
  chartRef: MutableRefObject<Chart | null>,
  getMode: () => OverlayMode,
  baseTheme: Theme,
  onTextPlaced?: (id: string, point: Partial<Point>) => void,
): DrawingsApi {
  // Undo/redo history (#16). stack[ptr] is the current drawing set; `restoring`
  // suppresses history capture while overlays are recreated.
  const historyRef = useRef<{ stack: Snap[]; ptr: number }>({ stack: [[]], ptr: 0 });
  const restoringRef = useRef(false);
  const historySubs = useRef(new Set<() => void>());

  // Armed-drawing state (#3): which tool is mid-draw, the id of its in-progress
  // overlay (so it can be cancelled), and subscribers (the toolbar).
  const activeToolRef = useRef<DrawingTool | null>(null);
  const progressIdRef = useRef<string | null>(null);
  const drawingSubs = useRef(new Set<(tool: DrawingTool | null) => void>());

  // Lock/hide state (#35), mirrored for getters and inherited by drawings
  // created after a toggle, plus the named-template store.
  const lockedRef = useRef(false);
  const hiddenRef = useRef(false);
  const visibleSubs = useRef(new Set<(visible: boolean) => void>());
  const templatesRef = useRef(new DrawingTemplateStore());

  // Brush/highlighter stroke styles (color + width), seeded from theme presets;
  // each new stroke reads the current value. Seeded once (matches prior behavior).
  const brushStylesRef = useRef<Record<BrushTool, BrushStyle>>({
    brush: brushStyle("brush", baseTheme),
    highlighter: brushStyle("highlighter", baseTheme),
  });
  const brushSubs = useRef(new Set<() => void>());

  // Default text-label style (color + size), applied to each new text overlay.
  const textStyleRef = useRef<TextStyle>({ ...DEFAULT_TEXT_STYLE });
  const textStyleSubs = useRef(new Set<() => void>());

  // Live mirror of the text-placed callback so the once-built API never calls a
  // stale closure.
  const onTextPlacedRef = useRef(onTextPlaced);
  onTextPlacedRef.current = onTextPlaced;

  // Build the API once; every method reads refs, so a single stable object stays
  // correct across renders (the component's []-deps handle can capture it).
  const apiRef = useRef<DrawingsApi | null>(null);
  if (!apiRef.current) {
    const notifyHistory = () => historySubs.current.forEach((cb) => cb());
    const notifyBrush = () => brushSubs.current.forEach((cb) => cb());
    const setActiveTool = (tool: DrawingTool | null) => {
      activeToolRef.current = tool;
      drawingSubs.current.forEach((cb) => cb(tool));
    };

    // Push the current lock/visible state onto every user drawing. Also called
    // after creating overlays so fresh drawings inherit the state.
    const applyDrawingFlags = () => {
      chartRef.current?.overrideOverlay({ groupId: USER_DRAWING_GROUP, lock: lockedRef.current, visible: !hiddenRef.current });
    };

    const snapshotDrawings = (): Snap =>
      (chartRef.current?.getOverlays({ groupId: USER_DRAWING_GROUP }) ?? []).map((o) => ({
        name: o.name,
        points: o.points,
        styles: o.styles,
        mode: o.mode,
        // Brush/highlighter carry their colour+width here — keep it through
        // undo/redo and export/import.
        extendData: o.extendData,
      }));

    const pushHistory = () => {
      if (restoringRef.current) return;
      const h = historyRef.current;
      h.stack = h.stack.slice(0, h.ptr + 1);
      h.stack.push(snapshotDrawings());
      // Bound memory: drop the oldest entries past the cap.
      if (h.stack.length > HISTORY_CAP) h.stack = h.stack.slice(h.stack.length - HISTORY_CAP);
      h.ptr = h.stack.length - 1;
      notifyHistory();
    };

    const beginDrawing = (tool: string) => {
      // Brush/highlighter are one continuous-draw overlay (`sonrBrush`) styled by
      // extendData; magnet snapping is meaningless for freehand, so force normal.
      const brush = isBrushTool(tool);
      const isText = tool === TEXT_OVERLAY;
      const id = chartRef.current?.createOverlay({
        name: brush ? BRUSH_OVERLAY : tool,
        groupId: USER_DRAWING_GROUP,
        mode: brush ? "normal" : getMode(),
        ...(brush ? { extendData: { ...brushStylesRef.current[tool as BrushTool] } } : {}),
        ...(isText ? { extendData: { text: "", ...textStyleRef.current } } : {}),
        onDrawEnd: (e) => {
          // Drawing placed: the overlay is now a finished drawing, not in progress.
          progressIdRef.current = null;
          pushHistory();
          // A freshly placed drawing inherits the current lock/hide state.
          applyDrawingFlags();
          // Brush/highlighter are "sticky": stay armed and immediately re-arm for
          // the next stroke, so you can draw repeatedly without re-clicking the
          // toolbar. The tool stays active until toggled off (cancelDrawing).
          if (brush) beginDrawing(tool);
          else setActiveTool(null);
          // Text: hand the placed anchor to the host so it can show an inline
          // input and store the typed string in the overlay's extendData.
          if (isText && e?.overlay) onTextPlacedRef.current?.(e.overlay.id, e.overlay.points?.[0] ?? {});
          return false;
        },
        onRemoved: () => {
          pushHistory();
          return false;
        },
      });
      progressIdRef.current = typeof id === "string" ? id : Array.isArray(id) ? (id[0] ?? null) : null;
      setActiveTool(tool as DrawingTool);
    };

    // Cancel an armed-but-unplaced drawing (toggling the tool off). Removes only
    // the in-progress overlay, leaving finished drawings untouched.
    const cancelDrawing = () => {
      const id = progressIdRef.current;
      progressIdRef.current = null;
      setActiveTool(null);
      if (id) {
        restoringRef.current = true; // a cancelled draw isn't a history step
        chartRef.current?.removeOverlay({ id });
        restoringRef.current = false;
      }
    };

    const restoreDrawings = (snap: Snap) => {
      const chart = chartRef.current;
      if (!chart) return;
      restoringRef.current = true;
      chart.removeOverlay({ groupId: USER_DRAWING_GROUP });
      for (const d of snap) {
        chart.createOverlay({
          name: d.name,
          points: d.points,
          styles: d.styles,
          mode: d.mode,
          extendData: d.extendData,
          groupId: USER_DRAWING_GROUP,
          onDrawEnd: () => {
            pushHistory();
            return false;
          },
          onRemoved: () => {
            pushHistory();
            return false;
          },
        });
      }
      restoringRef.current = false;
      // Restored drawings inherit the current lock/hide state.
      applyDrawingFlags();
    };

    const initHistory = () => {
      historyRef.current = { stack: [[]], ptr: 0 };
    };
    const resetHistoryToCurrent = () => {
      historyRef.current = { stack: [snapshotDrawings()], ptr: 0 };
    };

    apiRef.current = {
      beginDrawing,
      cancelDrawing,
      activeDrawing: () => activeToolRef.current,
      subscribeDrawing: (cb) => {
        drawingSubs.current.add(cb);
        return () => drawingSubs.current.delete(cb);
      },
      clearDrawings: () => {
        chartRef.current?.removeOverlay({ groupId: USER_DRAWING_GROUP });
        pushHistory();
      },
      snapshotDrawings,
      restoreDrawings,
      undo: () => {
        const h = historyRef.current;
        if (h.ptr <= 0) return;
        h.ptr -= 1;
        restoreDrawings(h.stack[h.ptr]);
        notifyHistory();
      },
      redo: () => {
        const h = historyRef.current;
        if (h.ptr >= h.stack.length - 1) return;
        h.ptr += 1;
        restoreDrawings(h.stack[h.ptr]);
        notifyHistory();
      },
      canUndo: () => historyRef.current.ptr > 0,
      canRedo: () => historyRef.current.ptr < historyRef.current.stack.length - 1,
      subscribeHistory: (cb) => {
        historySubs.current.add(cb);
        return () => historySubs.current.delete(cb);
      },
      initHistory,
      resetHistoryToCurrent,
      recordHistory: pushHistory,
      setDrawingsLocked: (locked) => {
        lockedRef.current = locked;
        applyDrawingFlags();
      },
      getDrawingsLocked: () => lockedRef.current,
      setDrawingsVisible: (visible) => {
        hiddenRef.current = !visible;
        applyDrawingFlags();
        visibleSubs.current.forEach((cb) => cb(visible));
      },
      getDrawingsVisible: () => !hiddenRef.current,
      subscribeDrawingsVisible: (cb) => {
        visibleSubs.current.add(cb);
        return () => visibleSubs.current.delete(cb);
      },
      saveDrawingTemplate: (name) => {
        templatesRef.current.save(name, snapshotDrawings());
      },
      applyDrawingTemplate: (name) => {
        const snap = templatesRef.current.get(name);
        if (!snap) return;
        restoreDrawings(snap);
        // Reset the undo history to the applied drawing set (like importState).
        resetHistoryToCurrent();
        notifyHistory();
      },
      listDrawingTemplates: () => templatesRef.current.list(),
      deleteDrawingTemplate: (name) => templatesRef.current.delete(name),
      subscribeDrawingTemplates: (cb) => templatesRef.current.subscribe(cb),
      cloneLastDrawing: () => {
        const chart = chartRef.current;
        if (!chart) return;
        const drawings = chart.getOverlays({ groupId: USER_DRAWING_GROUP }) ?? [];
        const last = drawings[drawings.length - 1];
        if (!last) return;
        restoringRef.current = true;
        chart.createOverlay({
          name: last.name,
          points: last.points,
          styles: last.styles,
          mode: last.mode,
          extendData: last.extendData,
          groupId: USER_DRAWING_GROUP,
          onDrawEnd: () => {
            pushHistory();
            return false;
          },
          onRemoved: () => {
            pushHistory();
            return false;
          },
        });
        restoringRef.current = false;
        applyDrawingFlags();
        pushHistory();
      },
      getBrushStyle: (tool) => ({ ...brushStylesRef.current[tool] }),
      setBrushStyle: (tool, style) => {
        brushStylesRef.current[tool] = { ...style };
        notifyBrush();
      },
      subscribeBrush: (cb) => {
        brushSubs.current.add(cb);
        return () => brushSubs.current.delete(cb);
      },
      getTextStyle: () => ({ ...textStyleRef.current }),
      setTextStyle: (style) => {
        textStyleRef.current = { ...style };
        textStyleSubs.current.forEach((cb) => cb());
      },
      subscribeTextStyle: (cb) => {
        textStyleSubs.current.add(cb);
        return () => textStyleSubs.current.delete(cb);
      },
      listDrawings: () =>
        (chartRef.current?.getOverlays({ groupId: USER_DRAWING_GROUP }) ?? []).map((o) => ({
          id: o.id,
          name: o.name,
          label: drawingLabel(o.name, o.extendData),
          visible: o.visible,
          locked: o.lock,
        })),
      setDrawingVisible: (id, visible) => {
        chartRef.current?.overrideOverlay({ id, visible });
      },
      setDrawingLocked: (id, locked) => {
        chartRef.current?.overrideOverlay({ id, lock: locked });
      },
      removeDrawing: (id) => {
        // removeOverlay fires the overlay's onRemoved → records a history step.
        chartRef.current?.removeOverlay({ id });
      },
    };
  }

  return apiRef.current;
}

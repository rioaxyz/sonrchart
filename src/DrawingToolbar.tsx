import { useEffect, useMemo, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { SonrChartHandle } from "./SonrChart";
import type { DrawingTool, Magnet } from "./types";
import { DEFAULT_DRAWING_TOOLS, type DrawingToolOption } from "./drawings";
import { ensureDefaultStyles } from "./defaultStyles";
import { DrawIcon, ClearIcon, UndoIcon, RedoIcon, PencilIcon } from "./icons";
import { useDropdown } from "./useDropdown";
import { mergeLabels, type Labels } from "./labels";

// Drop-in drawing chrome (issues #3, #13, #16): the line/drawing tools collapse
// into a single dropdown (there are a lot of them), with a magnet-mode toggle,
// undo/redo, and Clear alongside as their own buttons — all driving one chart
// ref. Compose your own UI on the same ref API if you prefer.

// Magnet cycles off → weak → strong → off.
function normalizeMagnet(m: Magnet | undefined): "off" | "weak" | "strong" {
  if (m === "strong") return "strong";
  if (m === "weak" || m === true) return "weak";
  return "off";
}
const NEXT_MAGNET: Record<"off" | "weak" | "strong", Magnet | undefined> = {
  off: "weak",
  weak: "strong",
  strong: undefined,
};

export function DrawingToolbar({
  chartRef,
  tools = DEFAULT_DRAWING_TOOLS,
  className,
  showClear = true,
  showMagnet = true,
  showHistory = true,
  labels,
}: {
  chartRef: RefObject<SonrChartHandle>;
  tools?: DrawingToolOption[];
  className?: string;
  showClear?: boolean;
  showMagnet?: boolean;
  showHistory?: boolean;
  labels?: Partial<Labels>;
}) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);
  // A tool's label override (if any) wins over the option's built-in label.
  const labelFor = (t: DrawingToolOption) => L.drawingToolLabels[t.tool] ?? t.label;

  const [active, setActive] = useState<DrawingTool | null>(null);
  const [magnet, setMagnetState] = useState<"off" | "weak" | "strong">("off");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const { open, setOpen, toggle: toggleOpen, pos, triggerRef, panelRef } = useDropdown();

  // Subscribe to the chart's drawing/magnet/history state. The handle may not be
  // populated on the first tick (the chart mounts as a sibling), so retry until
  // it's available, then seed + listen.
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    let cancelled = false;
    const attach = () => {
      if (cancelled) return;
      const h = chartRef.current;
      if (h?.subscribeDrawing) {
        setActive(h.activeDrawing?.() ?? null);
        unsubs.push(h.subscribeDrawing(setActive));
        setMagnetState(normalizeMagnet(h.getMagnet?.()));
        if (h.subscribeMagnet) unsubs.push(h.subscribeMagnet((m) => setMagnetState(normalizeMagnet(m))));
        const syncHistory = () => {
          setCanUndo(h.canUndo?.() ?? false);
          setCanRedo(h.canRedo?.() ?? false);
        };
        syncHistory();
        if (h.subscribeHistory) unsubs.push(h.subscribeHistory(syncHistory));
      } else {
        setTimeout(attach, 50);
      }
    };
    attach();
    return () => {
      cancelled = true;
      for (const u of unsubs) u();
    };
  }, [chartRef]);

  const onToolClick = (tool: DrawingTool) => {
    const h = chartRef.current;
    if (!h) return;
    // Clicking the armed tool toggles it off; otherwise arm the new tool.
    if (active === tool) h.cancelDrawing();
    else h.startDrawing(tool);
    setOpen(false);
  };

  const activeOpt = tools.find((t) => t.tool === active);
  const activeLabel = activeOpt ? labelFor(activeOpt) : undefined;

  return (
    <div className={className ?? "sonr-drawing-toolbar"} role="group" aria-label={L.drawingTools}>
      {/* Tool palette — collapsed into one dropdown. */}
      <div className="sonr-draw-menu">
        <button
          ref={triggerRef}
          type="button"
          className={`sonr-menu-trigger sonr-icon-trigger${open ? " open" : ""}${active ? " on" : ""}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={activeLabel ? `${L.drawingTools}: ${activeLabel}` : L.drawingTools}
          title={activeLabel ? `${L.drawingTools}: ${activeLabel}` : L.drawingTools}
          onClick={toggleOpen}
        >
          {active ? <DrawIcon tool={active} /> : <PencilIcon />}
          <span className="sonr-menu-caret" aria-hidden>
            ▾
          </span>
        </button>
        {open &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={panelRef}
              className="sonr-menu-dropdown"
              role="menu"
              aria-label={L.drawingTools}
              style={{ position: "fixed", top: pos.top, left: pos.left }}
            >
              {tools.map((t) => {
                const on = active === t.tool;
                return (
                  <button
                    key={t.tool}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    className={`sonr-menu-option${on ? " on" : ""}`}
                    onClick={() => onToolClick(t.tool)}
                  >
                    <span className="sonr-menu-check" aria-hidden>
                      {on ? "✓" : ""}
                    </span>
                    <span className="sonr-draw-opt-icon" aria-hidden>
                      <DrawIcon tool={t.tool} />
                    </span>
                    <span className="sonr-menu-label sonr-menu-label-wide">{labelFor(t)}</span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )}
      </div>
      {showMagnet && (
        <button
          type="button"
          className={`sonr-draw-btn${magnet !== "off" ? " on" : ""}`}
          aria-pressed={magnet !== "off"}
          title={`${L.magnet}: ${magnet}${magnet === "off" ? " — snap new drawings to nearby OHLC" : ""} (click to cycle)`}
          onClick={() => chartRef.current?.setMagnet(NEXT_MAGNET[magnet])}
        >
          {L.magnet}{magnet !== "off" ? ` · ${magnet}` : ""}
        </button>
      )}
      {showHistory && (
        <>
          <button
            type="button"
            className="sonr-draw-btn sonr-icon-btn"
            title={L.undo}
            aria-label={L.undo}
            disabled={!canUndo}
            onClick={() => chartRef.current?.undo()}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            className="sonr-draw-btn sonr-icon-btn"
            title={L.redo}
            aria-label={L.redo}
            disabled={!canRedo}
            onClick={() => chartRef.current?.redo()}
          >
            <RedoIcon />
          </button>
        </>
      )}
      {showClear && (
        <button
          type="button"
          className="sonr-draw-btn sonr-draw-clear sonr-icon-btn"
          title="Remove all drawings"
          aria-label={L.clear}
          onClick={() => chartRef.current?.clearDrawings()}
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
}

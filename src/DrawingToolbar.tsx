import { useEffect, useState, type RefObject } from "react";
import type { SonrChartHandle } from "./SonrChart";
import type { DrawingTool, Magnet } from "./types";
import { DEFAULT_DRAWING_TOOLS, type DrawingToolOption } from "./drawings";
import { ensureDefaultStyles } from "./defaultStyles";
import { DrawIcon, ClearIcon, UndoIcon, RedoIcon } from "./icons";

// Drop-in drawing chrome (issues #3, #13, #16): a tool palette, a magnet-mode
// toggle, undo/redo, and a Clear button — all driving one chart ref. Each tool
// button arms interactive drawing and highlights while armed (clicking it again
// cancels); the armed state clears once the drawing is placed. Compose your own
// UI on the same ref API if you prefer.

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
}: {
  chartRef: RefObject<SonrChartHandle>;
  tools?: DrawingToolOption[];
  className?: string;
  showClear?: boolean;
  showMagnet?: boolean;
  showHistory?: boolean;
}) {
  useEffect(ensureDefaultStyles, []);

  const [active, setActive] = useState<DrawingTool | null>(null);
  const [magnet, setMagnetState] = useState<"off" | "weak" | "strong">("off");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

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
  };

  return (
    <div className={className ?? "sonr-drawing-toolbar"} role="group" aria-label="Drawing tools">
      {tools.map((t) => {
        const on = active === t.tool;
        return (
          <button
            key={t.tool}
            type="button"
            className={`sonr-draw-btn sonr-icon-btn${on ? " on" : ""}`}
            aria-pressed={on}
            aria-label={t.label}
            title={t.label}
            onClick={() => onToolClick(t.tool)}
          >
            <DrawIcon tool={t.tool} />
          </button>
        );
      })}
      {showMagnet && (
        <button
          type="button"
          className={`sonr-draw-btn${magnet !== "off" ? " on" : ""}`}
          aria-pressed={magnet !== "off"}
          title={`Magnet: ${magnet}${magnet === "off" ? " — snap new drawings to nearby OHLC" : ""} (click to cycle)`}
          onClick={() => chartRef.current?.setMagnet(NEXT_MAGNET[magnet])}
        >
          Magnet{magnet !== "off" ? ` · ${magnet}` : ""}
        </button>
      )}
      {showHistory && (
        <>
          <button
            type="button"
            className="sonr-draw-btn sonr-icon-btn"
            title="Undo"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => chartRef.current?.undo()}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            className="sonr-draw-btn sonr-icon-btn"
            title="Redo"
            aria-label="Redo"
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
          aria-label="Clear drawings"
          onClick={() => chartRef.current?.clearDrawings()}
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
}

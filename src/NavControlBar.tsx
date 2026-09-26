import { useEffect, useMemo, type RefObject } from "react";
import type { SonrChartHandle } from "./SonrChart";
import { ensureDefaultStyles } from "./defaultStyles";
import { mergeLabels, type Labels } from "./labels";
import { ZoomInIcon, ZoomOutIcon, FitIcon, RealtimeIcon } from "./icons";

// Nav / control bar (issue #45): a small horizontal cluster of icon buttons that
// live over the bottom-right of the chart — zoom out, zoom in, fit-all, and jump
// to realtime. Every action is a one-shot call on the chart handle (no local
// state, no subscription), so the bar is a pure control surface. Icons come from
// the shared homegrown set (./icons).

export function NavControlBar({
  chartRef,
  labels,
  className,
}: {
  chartRef: RefObject<SonrChartHandle>;
  labels?: Partial<Labels>;
  className?: string;
}) {
  useEffect(ensureDefaultStyles, []);
  const L = useMemo(() => mergeLabels(labels), [labels]);

  // These keys are new to Labels — listed in labelKeys so the lead adds them to
  // the Labels type + DEFAULT_LABELS (with the English defaults given there).
  const zoomOutLabel = L.zoomOut;
  const zoomInLabel = L.zoomIn;
  const fitLabel = L.fitContent;
  const realtimeLabel = L.goToRealtime;

  return (
    <div className={className ?? "sonr-navbar"} role="group" aria-label={L.navControls}>
      <button
        type="button"
        className="sonr-nav-btn"
        title={zoomOutLabel}
        aria-label={zoomOutLabel}
        onClick={() => chartRef.current?.zoomOut?.()}
      >
        <ZoomOutIcon />
      </button>
      <button
        type="button"
        className="sonr-nav-btn"
        title={zoomInLabel}
        aria-label={zoomInLabel}
        onClick={() => chartRef.current?.zoomIn?.()}
      >
        <ZoomInIcon />
      </button>
      <button
        type="button"
        className="sonr-nav-btn"
        title={fitLabel}
        aria-label={fitLabel}
        onClick={() => chartRef.current?.setVisibleDuration?.(Infinity)}
      >
        <FitIcon />
      </button>
      <button
        type="button"
        className="sonr-nav-btn"
        title={realtimeLabel}
        aria-label={realtimeLabel}
        onClick={() => chartRef.current?.scrollToRealTime?.()}
      >
        <RealtimeIcon />
      </button>
    </div>
  );
}

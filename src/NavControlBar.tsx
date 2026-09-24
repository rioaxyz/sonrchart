import { useEffect, useMemo, type RefObject } from "react";
import type { SonrChartHandle } from "./SonrChart";
import { ensureDefaultStyles } from "./defaultStyles";
import { mergeLabels, type Labels } from "./labels";

// Nav / control bar (issue #45): a small horizontal cluster of icon buttons that
// live over the bottom-right of the chart — zoom out, zoom in, fit-all, and jump
// to realtime. Every action is a one-shot call on the chart handle (no local
// state, no subscription), so the bar is a pure control surface. Icons are inline
// SVGs (currentColor, 14px) styled the same way as src/icons.tsx, deliberately
// self-contained so this file never couples to the shared icon set.

// Shared tiny-SVG wrapper (kept local — do NOT import from ./icons).
function NavSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      {children}
    </svg>
  );
}

/** Magnifier with a minus — zoom out. */
function ZoomOutIcon() {
  return (
    <NavSvg>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.4" y1="10.4" x2="14" y2="14" />
      <line x1="5" y1="7" x2="9" y2="7" />
    </NavSvg>
  );
}

/** Magnifier with a plus — zoom in. */
function ZoomInIcon() {
  return (
    <NavSvg>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.4" y1="10.4" x2="14" y2="14" />
      <line x1="5" y1="7" x2="9" y2="7" />
      <line x1="7" y1="5" x2="7" y2="9" />
    </NavSvg>
  );
}

/** Inward-pointing corner brackets — fit / reset the visible range to all data. */
function FitIcon() {
  return (
    <NavSvg>
      <path d="M2 5.5V2.5h3" />
      <path d="M14 5.5V2.5h-3" />
      <path d="M2 10.5v3h3" />
      <path d="M14 10.5v3h-3" />
    </NavSvg>
  );
}

/** Right-pointing chevron toward a bar — jump to the latest (realtime) bar. */
function RealtimeIcon() {
  return (
    <NavSvg>
      <path d="M3 4l4 4-4 4" />
      <line x1="9" y1="3" x2="9" y2="13" />
      <line x1="12.5" y1="3" x2="12.5" y2="13" />
    </NavSvg>
  );
}

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

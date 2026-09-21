import type { SonrChartHandle } from "./SonrChart";

// Screenshot helpers (issue #20). The chart ref's snapshot() returns a data
// URL; downloadSnapshot triggers a browser download of it.
export function downloadSnapshot(
  handle: SonrChartHandle | null,
  filename = "chart.png",
  opts?: { type?: "png" | "jpeg"; background?: string; includeOverlays?: boolean },
): boolean {
  const url = handle?.snapshot(opts);
  if (!url) return false;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { DataWindow } from "../src/DataWindow";
import type { SonrChartHandle } from "../src/SonrChart";
import type { IndicatorRow } from "../src/types";

function fakeHandle(initial: IndicatorRow[]) {
  let rows = initial.slice();
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((cb) => cb());
  return {
    listIndicatorRows: () => rows.slice(),
    setIndicatorVisible: vi.fn((name: string, visible: boolean) => {
      rows = rows.map((r) => (r.name === name ? { ...r, visible } : r));
      notify();
    }),
    removeIndicator: vi.fn((name: string) => {
      rows = rows.filter((r) => r.name !== name);
      notify();
    }),
    subscribeIndicators: (cb: () => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  } as unknown as SonrChartHandle;
}

function ref(h: SonrChartHandle) {
  const r = createRef<SonrChartHandle>();
  (r as { current: SonrChartHandle }).current = h;
  return r;
}

describe("DataWindow (#45)", () => {
  it("lists active indicators, empty state otherwise", async () => {
    const { rerender } = render(<DataWindow chartRef={ref(fakeHandle([]))} />);
    expect(await screen.findByText("No indicators")).toBeInTheDocument();
    rerender(<DataWindow chartRef={ref(fakeHandle([{ name: "MA", visible: true }, { name: "VOL", visible: true }]))} />);
    expect(await screen.findByText("MA")).toBeInTheDocument();
    expect(screen.getByText("VOL")).toBeInTheDocument();
  });

  it("toggles indicator visibility via the eye and reflects it", async () => {
    const h = fakeHandle([{ name: "MA", visible: true }]);
    render(<DataWindow chartRef={ref(h)} />);
    const hide = await screen.findByRole("button", { name: "Hide: MA" });
    await userEvent.click(hide);
    expect(h.setIndicatorVisible).toHaveBeenCalledWith("MA", false);
    // Subscription flips the row to a "Show" affordance.
    expect(await screen.findByRole("button", { name: "Show: MA" })).toBeInTheDocument();
  });

  it("removes an indicator and drops its row", async () => {
    const h = fakeHandle([{ name: "MA", visible: true }, { name: "VOL", visible: true }]);
    render(<DataWindow chartRef={ref(h)} />);
    await userEvent.click(await screen.findByRole("button", { name: "Remove: MA" }));
    expect(h.removeIndicator).toHaveBeenCalledWith("MA");
    expect(screen.queryByText("MA")).toBeNull();
    expect(screen.getByText("VOL")).toBeInTheDocument();
  });
});

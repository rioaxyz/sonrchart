import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { ObjectTree } from "../src/ObjectTree";
import { drawingLabel } from "../src/drawings";
import type { SonrChartHandle } from "../src/SonrChart";
import type { DrawingRow } from "../src/types";

describe("drawingLabel (#45)", () => {
  it("shows a text label's own content, falling back to 'Text'", () => {
    expect(drawingLabel("text", { text: "buy zone" })).toBe("buy zone");
    expect(drawingLabel("text", { text: "  " })).toBe("Text");
    expect(drawingLabel("text", undefined)).toBe("Text");
  });
  it("labels freehand and maps tools to their names", () => {
    expect(drawingLabel("sonrBrush")).toBe("Freehand");
    expect(drawingLabel("segment")).toBe("Trend line");
    expect(drawingLabel("rectangle")).toBe("Rectangle");
    expect(drawingLabel("unknownTool")).toBe("unknownTool");
  });
});

function fakeHandle(initial: DrawingRow[]) {
  let rows = initial.slice();
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((cb) => cb());
  return {
    listDrawings: () => rows.slice(),
    setDrawingVisible: vi.fn((id: string, visible: boolean) => {
      rows = rows.map((r) => (r.id === id ? { ...r, visible } : r));
    }),
    setDrawingLocked: vi.fn((id: string, locked: boolean) => {
      rows = rows.map((r) => (r.id === id ? { ...r, locked } : r));
    }),
    removeDrawing: vi.fn((id: string) => {
      rows = rows.filter((r) => r.id !== id);
      notify();
    }),
    locateDrawing: vi.fn(),
    subscribeHistory: (cb: () => void) => {
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

describe("ObjectTree (#45)", () => {
  it("lists user drawings by label, empty state otherwise", async () => {
    render(<ObjectTree chartRef={ref(fakeHandle([]))} />);
    expect(await screen.findByText("No drawings yet")).toBeInTheDocument();
  });

  it("drives hide, lock, and remove per drawing through the handle", async () => {
    const h = fakeHandle([
      { id: "d1", name: "segment", label: "Trend line", visible: true, locked: false },
      { id: "d2", name: "text", label: "note", visible: true, locked: false },
    ]);
    render(<ObjectTree chartRef={ref(h)} />);
    expect(await screen.findByText("Trend line")).toBeInTheDocument();
    expect(screen.getByText("note")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hide: Trend line" }));
    expect(h.setDrawingVisible).toHaveBeenCalledWith("d1", false);
    // Re-read after the toggle flips the row to a "Show" affordance.
    expect(await screen.findByRole("button", { name: "Show: Trend line" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Lock: note" }));
    expect(h.setDrawingLocked).toHaveBeenCalledWith("d2", true);
    expect(await screen.findByRole("button", { name: "Unlock: note" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove: Trend line" }));
    expect(h.removeDrawing).toHaveBeenCalledWith("d1");
    expect(screen.queryByText("Trend line")).toBeNull();
  });

  it("locates a drawing when its label is clicked", async () => {
    const h = fakeHandle([{ id: "d1", name: "segment", label: "Trend line", visible: true, locked: false }]);
    render(<ObjectTree chartRef={ref(h)} />);
    await userEvent.click(await screen.findByText("Trend line"));
    expect(h.locateDrawing).toHaveBeenCalledWith("d1");
  });
});

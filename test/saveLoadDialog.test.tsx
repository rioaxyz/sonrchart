import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { SaveLoadDialog } from "../src/SaveLoadDialog";
import type { SonrChartHandle } from "../src/SonrChart";
import type { ChartState } from "../src/types";

const SAMPLE: ChartState = {
  version: 1,
  drawings: [{ name: "segment", points: [{ value: 100 }, { value: 110 }] }],
  indicators: [{ name: "MA", paneId: "candle_pane" }],
  priceScale: { type: "normal" },
};

function fakeHandle(state: ChartState = SAMPLE) {
  return {
    exportState: vi.fn((): ChartState => state),
    importState: vi.fn(),
  } as unknown as SonrChartHandle;
}

function ref(h: SonrChartHandle) {
  const r = createRef<SonrChartHandle>();
  (r as { current: SonrChartHandle }).current = h;
  return r;
}

describe("SaveLoadDialog (#15)", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
  });

  it("renders nothing when closed", () => {
    render(<SaveLoadDialog chartRef={ref(fakeHandle())} open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the exported state as pretty JSON", () => {
    render(<SaveLoadDialog chartRef={ref(fakeHandle())} open onClose={vi.fn()} />);
    const exportBox = screen.getByLabelText("Current chart state") as HTMLTextAreaElement;
    expect(exportBox.value).toBe(JSON.stringify(SAMPLE, null, 2));
    expect(exportBox).toHaveAttribute("readonly");
  });

  it("copies the exported JSON to the clipboard", async () => {
    render(<SaveLoadDialog chartRef={ref(fakeHandle())} open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(SAMPLE, null, 2));
    // The button flips to a "Copied" affordance.
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("parses pasted JSON and calls importState with the object, then closes", async () => {
    const h = fakeHandle();
    const onClose = vi.fn();
    render(<SaveLoadDialog chartRef={ref(h)} open onClose={onClose} />);
    const paste = screen.getByLabelText("Paste chart state to load");
    const next: ChartState = { version: 1, drawings: [], indicators: [{ name: "VOL" }] };
    // fireEvent-style set: type the serialized JSON in one shot.
    await userEvent.click(paste);
    await userEvent.paste(JSON.stringify(next));
    await userEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(h.importState).toHaveBeenCalledWith(next);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an inline error and does NOT call importState for invalid JSON", async () => {
    const h = fakeHandle();
    render(<SaveLoadDialog chartRef={ref(h)} open onClose={vi.fn()} />);
    const paste = screen.getByLabelText("Paste chart state to load");
    await userEvent.click(paste);
    await userEvent.paste("{ not valid json ]");
    await userEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(h.importState).not.toHaveBeenCalled();
  });

  it("rejects well-formed JSON that is not a chart state", async () => {
    const h = fakeHandle();
    render(<SaveLoadDialog chartRef={ref(h)} open onClose={vi.fn()} />);
    const paste = screen.getByLabelText("Paste chart state to load");
    await userEvent.click(paste);
    await userEvent.paste(JSON.stringify({ hello: "world" }));
    await userEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(h.importState).not.toHaveBeenCalled();
  });

  it("closes on the ✕ button and on overlay/Escape", async () => {
    const onClose = vi.fn();
    render(<SaveLoadDialog chartRef={ref(fakeHandle())} open onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

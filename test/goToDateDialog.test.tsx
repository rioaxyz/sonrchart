import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { GoToDateDialog, parseLocalDateTime } from "../src/GoToDateDialog";
import type { SonrChartHandle } from "../src/SonrChart";

function fakeHandle() {
  return {
    scrollToTimestamp: vi.fn((_ts: number) => {}),
  } as unknown as SonrChartHandle;
}

function ref(h: SonrChartHandle) {
  const r = createRef<SonrChartHandle>();
  (r as { current: SonrChartHandle }).current = h;
  return r;
}

describe("GoToDateDialog (#45)", () => {
  it("renders nothing when closed", () => {
    render(<GoToDateDialog chartRef={ref(fakeHandle())} open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("scrolls to the chosen epoch ms and closes on Go", async () => {
    const h = fakeHandle();
    const onClose = vi.fn();
    render(<GoToDateDialog chartRef={ref(h)} open onClose={onClose} />);

    const input = document.querySelector<HTMLInputElement>("input.sonr-gotodate-input")!;
    // Native datetime-local values are set directly (userEvent.type is flaky here).
    fireEvent.change(input, { target: { value: "2026-03-15T09:30" } });
    await userEvent.click(screen.getByRole("button", { name: "Go" }));

    const expected = new Date("2026-03-15T09:30").getTime();
    expect(h.scrollToTimestamp).toHaveBeenCalledWith(expected);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Go is disabled until a value is entered and does not scroll", async () => {
    const h = fakeHandle();
    render(<GoToDateDialog chartRef={ref(h)} open onClose={() => {}} />);
    const go = screen.getByRole("button", { name: "Go" });
    expect(go).toBeDisabled();
    expect(h.scrollToTimestamp).not.toHaveBeenCalled();
  });

  it("cancels on Escape and on overlay click", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<GoToDateDialog chartRef={ref(fakeHandle())} open onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Overlay click (mousedown on the backdrop) also cancels.
    onClose.mockClear();
    rerender(<GoToDateDialog chartRef={ref(fakeHandle())} open onClose={onClose} />);
    fireEvent.mouseDown(document.querySelector(".sonr-gotodate-overlay")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("honors custom labels", () => {
    render(
      <GoToDateDialog
        chartRef={ref(fakeHandle())}
        open
        onClose={() => {}}
        labels={{ goToDate: "Jump to", goToDateGo: "Jump" }}
      />,
    );
    expect(screen.getByText("Jump to")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jump" })).toBeInTheDocument();
  });

  it("parseLocalDateTime handles empty and valid inputs", () => {
    expect(parseLocalDateTime("")).toBeNull();
    expect(parseLocalDateTime("2026-03-15T09:30")).toBe(new Date("2026-03-15T09:30").getTime());
  });
});

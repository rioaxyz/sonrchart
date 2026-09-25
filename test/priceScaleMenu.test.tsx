import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { PriceScaleMenu } from "../src/PriceScaleMenu";
import type { SonrChartHandle } from "../src/SonrChart";
import type { PriceLabels } from "../src/types";

function labelsHandle() {
  let pl: Required<PriceLabels> = { lastValue: true, lastLine: true, high: true, low: true, countdown: false };
  const subs = new Set<() => void>();
  const h = {
    getPriceLabels: () => ({ ...pl }),
    setPriceLabels: vi.fn((next: Partial<PriceLabels>) => {
      pl = { ...pl, ...next };
      subs.forEach((cb) => cb());
    }),
    subscribePriceLabels: (cb: () => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  } as unknown as SonrChartHandle;
  const ref = createRef<SonrChartHandle>();
  (ref as { current: SonrChartHandle }).current = h;
  return { h, ref };
}

describe("PriceScaleMenu (#12)", () => {
  it("shows the current scale type and opens the options", async () => {
    render(<PriceScaleMenu value={{ type: "logarithm" }} onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /Scale/ });
    expect(trigger).toHaveTextContent("Logarithmic");
    await userEvent.click(trigger);
    expect(screen.getByRole("menuitemradio", { name: "Logarithmic" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Normal" })).toHaveAttribute("aria-checked", "false");
  });

  it("fires onChange preserving other fields and closes", async () => {
    const onChange = vi.fn();
    render(<PriceScaleMenu value={{ type: "normal", invert: true }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Scale/ }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Percent" }));
    expect(onChange).toHaveBeenCalledWith({ type: "percentage", invert: true });
    expect(screen.queryByRole("menuitemradio", { name: "Percent" })).toBeNull();
  });

  it("renders price-label toggles from the handle and flips them (#41)", async () => {
    const { h, ref } = labelsHandle();
    render(<PriceScaleMenu value={{ type: "normal" }} onChange={vi.fn()} chartRef={ref} />);
    await userEvent.click(screen.getByRole("button", { name: /Scale/ }));
    // Four label toggles, seeded on (aria-checked true).
    const high = screen.getByRole("menuitemcheckbox", { name: "High" });
    expect(high).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: "Last value" })).toBeInTheDocument();
    await userEvent.click(high);
    expect(h.setPriceLabels).toHaveBeenCalledWith({ high: false });
    // The subscription flips the toggle off.
    expect(screen.getByRole("menuitemcheckbox", { name: "High" })).toHaveAttribute("aria-checked", "false");
    // Countdown is off by default and toggles on.
    const countdown = screen.getByRole("menuitemcheckbox", { name: "Countdown" });
    expect(countdown).toHaveAttribute("aria-checked", "false");
    await userEvent.click(countdown);
    expect(h.setPriceLabels).toHaveBeenCalledWith({ countdown: true });
  });

  it("omits the label toggles when no chartRef is given", async () => {
    render(<PriceScaleMenu value={{ type: "normal" }} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Scale/ }));
    expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
  });
});

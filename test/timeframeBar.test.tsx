import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeframeBar } from "../src/TimeframeBar";
import type { Interval } from "../src/types";

const INTERVALS: Interval[] = ["10S", "1", "5", "60", "D"];

describe("TimeframeBar (#45)", () => {
  it("renders friendly labels and marks the active interval", () => {
    render(<TimeframeBar intervals={INTERVALS} interval="5" onIntervalChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "5m" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1h" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "10s" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "D" })).toBeInTheDocument();
  });

  it("switches on click, but not when the active one is re-clicked", async () => {
    const onChange = vi.fn();
    render(<TimeframeBar intervals={INTERVALS} interval="5" onIntervalChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "1h" }));
    expect(onChange).toHaveBeenCalledWith("60");
    await userEvent.click(screen.getByRole("button", { name: "5m" }));
    expect(onChange).toHaveBeenCalledTimes(1); // re-clicking the active one is a no-op
  });

  it("honors label overrides and renders a children slot", () => {
    render(
      <TimeframeBar intervals={INTERVALS} interval="1" onIntervalChange={vi.fn()} labels={{ "1": "1min" }}>
        <span>nav</span>
      </TimeframeBar>,
    );
    expect(screen.getByRole("button", { name: "1min" })).toBeInTheDocument();
    expect(screen.getByText("nav")).toBeInTheDocument();
  });
});

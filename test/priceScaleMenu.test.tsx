import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceScaleMenu } from "../src/PriceScaleMenu";

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
});

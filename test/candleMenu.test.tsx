import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CandleMenu } from "../src/CandleMenu";

describe("CandleMenu (#1 candle type)", () => {
  it("shows the current style and opens a single-select dropdown", async () => {
    render(<CandleMenu value="area" onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /Area/ });
    // Collapsed by default.
    expect(screen.queryByRole("menuitemradio", { name: /Heikin Ashi/ })).toBeNull();
    await userEvent.click(trigger);
    // Current style is checked; others are not.
    expect(screen.getByRole("menuitemradio", { name: /Area/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: /Candles/ })).toHaveAttribute("aria-checked", "false");
  });

  it("fires onChange with the picked style and closes", async () => {
    const onChange = vi.fn();
    render(<CandleMenu value="candle" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Candles/ }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Heikin Ashi/ }));
    expect(onChange).toHaveBeenCalledWith("heikin_ashi");
    // Closed after selection.
    expect(screen.queryByRole("menuitemradio", { name: /Heikin Ashi/ })).toBeNull();
  });
});

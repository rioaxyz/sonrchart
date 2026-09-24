import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Watchlist, formatChange } from "../src/Watchlist";
import type { Bar, DataSource } from "../src/types";

function bars(prev: number, last: number): Bar[] {
  return [
    { time: 1, open: prev, high: prev, low: prev, close: prev },
    { time: 2, open: last, high: last, low: last, close: last },
  ];
}

function makeDS(): DataSource {
  return {
    getBars: vi.fn(async (symbol: string): Promise<Bar[]> => {
      if (symbol === "AAPL") return bars(100, 110); // +10%
      if (symbol === "MSFT") return bars(200, 180); // -10%
      return bars(50, 50); // flat
    }),
    searchSymbols: vi.fn(async (q: string) => [
      { symbol: q.toUpperCase(), name: "Test Co" },
      { symbol: `${q.toUpperCase()}X`, name: "Other Co" },
    ]),
  };
}

describe("Watchlist (#45)", () => {
  it("formatChange signs and rounds", () => {
    expect(formatChange(0.1)).toBe("+10.00%");
    expect(formatChange(-0.1)).toBe("-10.00%");
    expect(formatChange(0)).toBe("0.00%");
  });

  it("renders seeded rows with last price and % change", async () => {
    render(<Watchlist dataSource={makeDS()} interval="1" symbols={["AAPL", "MSFT"]} />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    expect(await screen.findByText("110.00")).toBeInTheDocument();
    expect(await screen.findByText("+10.00%")).toBeInTheDocument();
    expect(screen.getByText("MSFT")).toBeInTheDocument();
    expect(await screen.findByText("180.00")).toBeInTheDocument();
    expect(await screen.findByText("-10.00%")).toBeInTheDocument();
  });

  it("shows the empty state with no symbols", () => {
    render(<Watchlist dataSource={makeDS()} interval="1" />);
    expect(screen.getByText("No symbols yet")).toBeInTheDocument();
  });

  it("searches and adds a picked symbol as a new row", async () => {
    const ds = makeDS();
    render(<Watchlist dataSource={ds} interval="1" />);
    await userEvent.type(screen.getByRole("combobox"), "goog");
    const options = await screen.findAllByRole("option");
    expect(options[0]).toHaveTextContent("GOOG");
    await userEvent.click(options[0]);
    // Row appears with its (flat) quote fetched via getBars.
    expect(await screen.findByText("GOOG")).toBeInTheDocument();
    expect(await screen.findByText("50.00")).toBeInTheDocument();
    expect(ds.getBars).toHaveBeenCalledWith("GOOG", "1", 2);
  });

  it("removes a row via the × button", async () => {
    render(<Watchlist dataSource={makeDS()} interval="1" symbols={["AAPL"]} />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove: AAPL" }));
    expect(screen.queryByText("AAPL")).toBeNull();
  });

  it("calls onSelect when a row is clicked", async () => {
    const onSelect = vi.fn();
    render(<Watchlist dataSource={makeDS()} interval="1" symbols={["AAPL"]} onSelect={onSelect} />);
    await userEvent.click(await screen.findByText("AAPL"));
    expect(onSelect).toHaveBeenCalledWith("AAPL");
  });
});

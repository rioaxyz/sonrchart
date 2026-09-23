import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SymbolSearch, isSpreadExpression } from "../src/SymbolSearch";
import type { DataSource, SymbolSearchResult } from "../src/types";

function source(results: SymbolSearchResult[], search = true): DataSource {
  const ds: DataSource = { getBars: vi.fn(async () => []) };
  if (search) ds.searchSymbols = vi.fn(async () => results);
  return ds;
}

describe("isSpreadExpression", () => {
  it("detects operators between operands, ignores plain tickers", () => {
    expect(isSpreadExpression("AAPL/MSFT")).toBe(true);
    expect(isSpreadExpression("SPY*2")).toBe(true);
    expect(isSpreadExpression("1/x")).toBe(true);
    expect(isSpreadExpression("ES-NQ")).toBe(true);
    expect(isSpreadExpression("AAPL")).toBe(false);
    expect(isSpreadExpression("")).toBe(false);
  });
});

describe("SymbolSearch (#37)", () => {
  it("debounces and queries searchSymbols, rendering results", async () => {
    const user = userEvent.setup();
    const ds = source([
      { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ" },
      { symbol: "AAP", name: "Advance Auto Parts" },
    ]);
    render(<SymbolSearch dataSource={ds} onSelect={vi.fn()} />);
    await user.type(screen.getByRole("combobox"), "AAP");
    await waitFor(() => expect(ds.searchSymbols).toHaveBeenCalledWith("AAP"));
    expect(await screen.findByRole("option", { name: /AAPL/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Advance Auto Parts/ })).toBeInTheDocument();
  });

  it("fires onSelect with the symbol when a result is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const ds = source([{ symbol: "MSFT", name: "Microsoft" }]);
    render(<SymbolSearch dataSource={ds} onSelect={onSelect} />);
    await user.type(screen.getByRole("combobox"), "MS");
    await user.click(await screen.findByRole("option", { name: /MSFT/ }));
    expect(onSelect).toHaveBeenCalledWith("MSFT");
    // Input clears after selection.
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("passes a spread expression through on Enter as the raw string", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const ds = source([]);
    render(<SymbolSearch dataSource={ds} onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    await user.type(input, "AAPL/MSFT");
    // A synthetic "use expression" row appears.
    expect(await screen.findByRole("option", { name: /Use expression/ })).toBeInTheDocument();
    await user.type(input, "{Enter}");
    expect(onSelect).toHaveBeenCalledWith("AAPL/MSFT");
  });

  it("does not offer the expression row when spreadOperators is false", async () => {
    const user = userEvent.setup();
    const ds = source([]);
    render(<SymbolSearch dataSource={ds} onSelect={vi.fn()} spreadOperators={false} />);
    await user.type(screen.getByRole("combobox"), "AAPL/MSFT");
    await waitFor(() => expect(ds.searchSymbols).toHaveBeenCalled());
    expect(screen.queryByRole("option", { name: /Use expression/ })).toBeNull();
  });

  it("is a no-op and shows unavailable when searchSymbols is absent", async () => {
    const user = userEvent.setup();
    const ds = source([], false);
    expect(ds.searchSymbols).toBeUndefined();
    render(<SymbolSearch dataSource={ds} onSelect={vi.fn()} spreadOperators={false} />);
    await user.type(screen.getByRole("combobox"), "AAPL");
    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole("option")).toBeNull();
  });
});

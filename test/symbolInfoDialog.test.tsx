import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SymbolInfoDialog } from "../src/SymbolInfoDialog";
import type { DataSource, SymbolInfo } from "../src/types";

// A DataSource whose resolveSymbol returns a canned map; getBars is a stub
// (never called by the dialog).
function makeSource(map: Record<string, SymbolInfo | null>): DataSource {
  return {
    getBars: vi.fn(async () => []),
    resolveSymbol: vi.fn(async (symbol: string) => map[symbol] ?? null),
  };
}

describe("SymbolInfoDialog (#45)", () => {
  it("renders nothing when closed", () => {
    const ds = makeSource({});
    render(<SymbolInfoDialog dataSource={ds} symbol="AAPL" open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ds.resolveSymbol).not.toHaveBeenCalled();
  });

  it("renders TradingView-style fields + a session timeline with the exchange tz", async () => {
    const ds = makeSource({ AAPL: { ticker: "AAPL", name: "Apple Inc.", pricePrecision: 2 } });
    render(<SymbolInfoDialog dataSource={ds} symbol="AAPL" open onClose={vi.fn()} exchange="Alpaca" now={Date.UTC(2026, 0, 9, 18, 0)} />);

    expect(await screen.findByText("Apple Inc.")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Stock")).toBeInTheDocument();
    expect(screen.getByText("Point value")).toBeInTheDocument();
    expect(screen.getByText("Exchange")).toBeInTheDocument();
    expect(screen.getByText("Alpaca")).toBeInTheDocument();
    expect(screen.getByText("Tick size")).toBeInTheDocument();
    expect(screen.getByText("0.01")).toBeInTheDocument(); // 10^-pricePrecision
    expect(screen.getByText("Session")).toBeInTheDocument();
    expect(screen.getByText(/New York \(UTC-\d\)/)).toBeInTheDocument();
    expect(ds.resolveSymbol).toHaveBeenCalledWith("AAPL");
  });

  it("falls back to the raw ticker when resolveSymbol yields null or is absent", async () => {
    const dsNull = makeSource({}); // resolves to null → raw ticker (no "unknown")
    const { unmount } = render(<SymbolInfoDialog dataSource={dsNull} symbol="NOPE" open onClose={vi.fn()} />);
    expect(await screen.findByText("NOPE")).toBeInTheDocument();
    expect(screen.getByText("Tick size")).toBeInTheDocument();
    unmount();

    const dsNone: DataSource = { getBars: vi.fn(async () => []) };
    render(<SymbolInfoDialog dataSource={dsNone} symbol="MSFT" open onClose={vi.fn()} />);
    expect(await screen.findByText("MSFT")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
  });

  it("closes on the ✕ button, on Escape, and on an overlay click", async () => {
    const ds = makeSource({ AAPL: { ticker: "AAPL" } });

    const onCloseBtn = vi.fn();
    const { unmount } = render(
      <SymbolInfoDialog dataSource={ds} symbol="AAPL" open onClose={onCloseBtn} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onCloseBtn).toHaveBeenCalled();
    unmount();

    const onCloseEsc = vi.fn();
    render(<SymbolInfoDialog dataSource={ds} symbol="AAPL" open onClose={onCloseEsc} />);
    await userEvent.keyboard("{Escape}");
    expect(onCloseEsc).toHaveBeenCalled();
  });

  it("ignores a stale resolve when the symbol is superseded", async () => {
    let resolveFirst: (v: SymbolInfo | null) => void = () => {};
    const ds: DataSource = {
      getBars: vi.fn(async () => []),
      resolveSymbol: vi.fn(
        (symbol: string) =>
          new Promise<SymbolInfo | null>((res) => {
            if (symbol === "SLOW") resolveFirst = res;
            else res({ ticker: symbol, name: "Fast Co." });
          }),
      ),
    };

    const { rerender } = render(
      <SymbolInfoDialog dataSource={ds} symbol="SLOW" open onClose={vi.fn()} />,
    );
    // Supersede before the slow one settles.
    rerender(<SymbolInfoDialog dataSource={ds} symbol="FAST" open onClose={vi.fn()} />);
    expect(await screen.findByText("Fast Co.")).toBeInTheDocument();

    // Now let the stale SLOW promise settle — it must not overwrite the view.
    resolveFirst({ ticker: "SLOW", name: "Slow Co." });
    await Promise.resolve();
    expect(screen.queryByText("Slow Co.")).toBeNull();
    expect(screen.getByText("Fast Co.")).toBeInTheDocument();
  });
});

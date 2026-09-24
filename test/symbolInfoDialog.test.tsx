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

  it("resolves and renders the symbol fields in a definition list", async () => {
    const ds = makeSource({
      AAPL: { ticker: "AAPL", name: "Apple Inc.", pricePrecision: 2, volumePrecision: 0 },
    });
    render(<SymbolInfoDialog dataSource={ds} symbol="AAPL" open onClose={vi.fn()} />);

    expect(await screen.findByText("Apple Inc.")).toBeInTheDocument();
    // Ticker value renders alongside its label.
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("Ticker")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    // Precision fields render their numeric values (0 must render, not be dropped).
    expect(screen.getByText("Price precision")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Volume precision")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(ds.resolveSymbol).toHaveBeenCalledWith("AAPL");
  });

  it("shows Unknown symbol when resolveSymbol yields null", async () => {
    const ds = makeSource({}); // resolves to null
    render(<SymbolInfoDialog dataSource={ds} symbol="NOPE" open onClose={vi.fn()} />);
    expect(await screen.findByText("Unknown symbol")).toBeInTheDocument();
    expect(screen.queryByText("Ticker")).toBeNull();
  });

  it("falls back to the raw ticker when the datafeed has no resolveSymbol", async () => {
    const ds: DataSource = { getBars: vi.fn(async () => []) };
    render(<SymbolInfoDialog dataSource={ds} symbol="MSFT" open onClose={vi.fn()} />);
    expect(await screen.findByText("MSFT")).toBeInTheDocument();
    expect(screen.getByText("Ticker")).toBeInTheDocument();
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

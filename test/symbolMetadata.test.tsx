import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatWithUnit } from "../src/symbolFormat";
import { SymbolInfoDialog } from "../src/SymbolInfoDialog";
import { SymbolSearch } from "../src/SymbolSearch";
import type { DataSource, SymbolInfo } from "../src/types";

function makeSource(map: Record<string, SymbolInfo | null>): DataSource {
  return {
    getBars: vi.fn(async () => []),
    resolveSymbol: vi.fn(async (symbol: string) => map[symbol] ?? null),
  };
}

describe("formatWithUnit (#39)", () => {
  it("returns text unchanged with no quote metadata", () => {
    expect(formatWithUnit("12.30")).toBe("12.30");
    expect(formatWithUnit("12.30", {})).toBe("12.30");
  });
  it("hugs a glyph currency and spaces an alphabetic code", () => {
    expect(formatWithUnit("12.30", { currency: "$" })).toBe("$12.30");
    expect(formatWithUnit("12.30", { currency: "€" })).toBe("€12.30");
    expect(formatWithUnit("12.30", { currency: "USD" })).toBe("USD 12.30");
  });
  it("suffixes a unit and combines with currency", () => {
    expect(formatWithUnit("12.30", { unit: "pts" })).toBe("12.30 pts");
    expect(formatWithUnit("12.30", { currency: "$", unit: "pts" })).toBe("$12.30 pts");
  });
  it("ignores blank currency/unit", () => {
    expect(formatWithUnit("12.30", { currency: "  ", unit: "" })).toBe("12.30");
  });
});

describe("SymbolInfoDialog metadata + logos (#39)", () => {
  it("renders currency, unit, price source, description, and the logos", async () => {
    const ds = makeSource({
      BTCUSD: {
        ticker: "BTCUSD",
        name: "Bitcoin",
        pricePrecision: 2,
        currency: "USD",
        unit: "pts",
        priceSource: "Alpaca",
        description: "Bitcoin / US Dollar spot.",
        logo: "https://example.test/btc.png",
        exchangeLogo: "https://example.test/ex.png",
      },
    });
    render(<SymbolInfoDialog dataSource={ds} symbol="BTCUSD" open onClose={vi.fn()} listedExchange="COIN" />);

    expect(await screen.findByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("Currency")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.getByText("pts")).toBeInTheDocument();
    expect(screen.getByText("Price source")).toBeInTheDocument();
    expect(screen.getByText("Alpaca")).toBeInTheDocument();
    expect(screen.getByText("Bitcoin / US Dollar spot.")).toBeInTheDocument();
    const imgs = document.querySelectorAll("img");
    const srcs = Array.from(imgs).map((i) => i.getAttribute("src"));
    expect(srcs).toContain("https://example.test/btc.png");
    expect(srcs).toContain("https://example.test/ex.png");
  });

  it("omits metadata rows when the symbol has none", async () => {
    const ds = makeSource({ AAPL: { ticker: "AAPL", name: "Apple", pricePrecision: 2 } });
    render(<SymbolInfoDialog dataSource={ds} symbol="AAPL" open onClose={vi.fn()} />);
    expect(await screen.findByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Currency")).toBeNull();
    expect(screen.queryByText("Unit")).toBeNull();
    expect(screen.queryByText("Price source")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("SymbolSearch logos (#39)", () => {
  it("renders a per-result logo when provided", async () => {
    const ds: DataSource = {
      getBars: vi.fn(async () => []),
      searchSymbols: vi.fn(async () => [
        { symbol: "AAPL", name: "Apple", logo: "https://example.test/aapl.png" },
        { symbol: "MSFT", name: "Microsoft" }, // no logo
      ]),
    };
    render(<SymbolSearch dataSource={ds} onSelect={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "AAP");
    // Wait for the debounced result render.
    expect(await screen.findByText("Apple")).toBeInTheDocument();
    const logo = document.querySelector("img.sonr-search-logo");
    expect(logo?.getAttribute("src")).toBe("https://example.test/aapl.png");
    // Only the result with a logo gets an <img>.
    expect(document.querySelectorAll("img.sonr-search-logo")).toHaveLength(1);
  });
});

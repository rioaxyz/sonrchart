import { describe, it, expect, vi } from "vitest";
import { forwardRef, useImperativeHandle } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the heavy chart canvas so the shell test focuses on composition. The
// stub exposes a fake handle with just the methods the side-panel + timezone
// menu read at render time; everything else is a harmless no-op.
// A permissive fake handle: getters return sane defaults, subscribe*/list*
// behave, and any other method is a no-op — so no toolbar child crashes on a
// delayed attach timer regardless of which handle method it happens to read.
const fakeHandle: any = new Proxy(
  {},
  {
    get(_t, prop: string) {
      switch (prop) {
        case "getTimezone":
          return () => "America/New_York";
        case "getCandleStyle":
          return () => "candle";
        case "getPriceScale":
          return () => ({ type: "normal" });
        case "getSessions":
          return () => false;
        case "getTheme":
          return () => "dark";
        case "getMagnet":
          return () => undefined;
        case "getWatermark":
          return () => ({ symbol: true, interval: true, color: "#000", opacity: 0.1 });
        case "getPriceLabels":
          return () => ({ lastValue: true, lastLine: true, high: true, low: true, countdown: false });
        case "getBrushStyle":
          return () => ({ color: "#000", size: 2 });
        case "getTextStyle":
          return () => ({ color: "#000", size: 14 });
        case "getDrawingsLocked":
        case "getDrawingsVisible":
        case "canUndo":
        case "canRedo":
          return () => false;
        case "activeDrawing":
          return () => null;
      }
      if (prop.startsWith("list")) return () => [];
      if (prop.startsWith("subscribe")) return () => () => {};
      return () => {};
    },
  },
);
vi.mock("../src/SonrChart", () => ({
  SonrChart: forwardRef((_props: any, ref: any) => {
    useImperativeHandle(ref, () => fakeHandle, []);
    return <div data-testid="sonr-chart" />;
  }),
}));

import { SonrChartShell } from "../src/SonrChartShell";
import type { DataSource } from "../src/types";

const ds: DataSource = {
  getBars: vi.fn(async () => []),
  resolveSymbol: vi.fn(async (s: string) => ({ ticker: s, pricePrecision: 2 })),
  searchSymbols: vi.fn(async () => []),
};

describe("SonrChartShell", () => {
  it("renders the full chrome — toolbar, chart, timezone control, Objects toggle", () => {
    render(<SonrChartShell symbol="AAPL" interval="5" dataSource={ds} source="Alpaca" />);
    expect(screen.getByRole("toolbar", { name: "Chart toolbar" })).toBeInTheDocument();
    expect(screen.getByTestId("sonr-chart")).toBeInTheDocument();
    // Timezone menu is built in (shows the default zone).
    expect(screen.getByRole("button", { name: /Timezone/ })).toHaveTextContent("New York");
    // Objects toggle icon lives in the toolbar (labelled by the data-window string).
    expect(screen.getByRole("button", { name: "Indicators & objects" })).toBeInTheDocument();
  });

  it("has no Watchlist anywhere (removed)", () => {
    render(<SonrChartShell symbol="AAPL" interval="5" dataSource={ds} />);
    expect(screen.queryByText(/Watchlist/i)).toBeNull();
    expect(screen.queryByRole("group", { name: /watchlist/i })).toBeNull();
    expect(document.querySelector(".sonr-watchlist")).toBeNull();
  });

  it("toggles the side panel from the Objects button (data window + object tree, save/load, symbol info)", async () => {
    render(<SonrChartShell symbol="AAPL" interval="5" dataSource={ds} />);
    // Panel closed initially.
    expect(document.querySelector(".sonr-side-panel")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Indicators & objects" }));
    const panel = document.querySelector(".sonr-side-panel");
    expect(panel).not.toBeNull();
    // Side-panel tools open the dialogs.
    expect(screen.getByRole("button", { name: "Save / Load" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Symbol info" })).toBeInTheDocument();
  });

  it("renders the brand slot only when provided", () => {
    const { rerender } = render(<SonrChartShell symbol="AAPL" interval="5" dataSource={ds} />);
    expect(document.querySelector(".sonr-brand")).toBeNull();
    rerender(<SonrChartShell symbol="AAPL" interval="5" dataSource={ds} brand={<span>LOGO</span>} />);
    expect(screen.getByText("LOGO")).toBeInTheDocument();
  });
});

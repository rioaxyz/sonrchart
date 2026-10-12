import { describe, it, expect, beforeEach } from "vitest";
import { DrawingStore, drawingStoreFor, clearPersistedDrawings } from "../src/drawingPersistence";
import type { DrawingSnapshot } from "../src/drawingTemplates";

const seg = (ts: number): DrawingSnapshot => [{ name: "segment", points: [{ timestamp: ts, value: 100 }] }];

describe("DrawingStore (#97 per-symbol drawing sets)", () => {
  it("keeps each symbol's set isolated", () => {
    const store = new DrawingStore();
    store.save("AAPL", seg(1000));
    store.save("TSLA", seg(2000));
    expect(store.load("AAPL")![0].points[0].timestamp).toBe(1000);
    expect(store.load("TSLA")![0].points[0].timestamp).toBe(2000);
    expect(store.load("MSFT")).toBeNull();
    expect(store.symbols()).toEqual(["AAPL", "TSLA"]);
  });

  it("an empty save erases the entry — cleared and never-drawn restore identically", () => {
    const store = new DrawingStore();
    store.save("AAPL", seg(1000));
    store.save("AAPL", []);
    expect(store.load("AAPL")).toBeNull();
    expect(store.symbols()).toEqual([]);
  });

  it("ignores a save under an empty symbol", () => {
    const store = new DrawingStore();
    store.save("", seg(1000));
    expect(store.symbols()).toEqual([]);
  });

  it("clear drops one symbol or all", () => {
    const store = new DrawingStore();
    store.save("AAPL", seg(1));
    store.save("TSLA", seg(2));
    store.clear("AAPL");
    expect(store.load("AAPL")).toBeNull();
    expect(store.load("TSLA")).not.toBeNull();
    store.clear();
    expect(store.symbols()).toEqual([]);
  });
});

describe("keyed registry (#97 remount survival)", () => {
  beforeEach(() => clearPersistedDrawings());

  it("returns the same store for the same key, distinct stores for distinct keys", () => {
    const a = drawingStoreFor("tile-a");
    a.save("AAPL", seg(1));
    expect(drawingStoreFor("tile-a")).toBe(a); // stable across "remounts"
    expect(drawingStoreFor("tile-b").load("AAPL")).toBeNull(); // isolated
  });

  it("clearPersistedDrawings drops a key's store (or all)", () => {
    drawingStoreFor("tile-a").save("AAPL", seg(1));
    clearPersistedDrawings("tile-a");
    expect(drawingStoreFor("tile-a").load("AAPL")).toBeNull();
    drawingStoreFor("tile-b").save("TSLA", seg(2));
    clearPersistedDrawings();
    expect(drawingStoreFor("tile-b").load("TSLA")).toBeNull();
  });
});

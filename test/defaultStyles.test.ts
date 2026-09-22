import { afterEach, describe, expect, it } from "vitest";
import { ensureDefaultStyles } from "../src/defaultStyles";

const STYLE_ID = "sonr-chart-default-styles";

afterEach(() => {
  document.getElementById(STYLE_ID)?.remove();
  document.documentElement.removeAttribute("data-sonr-no-default-styles");
});

describe("ensureDefaultStyles (monochrome default chrome)", () => {
  it("injects one <style> into <head> with the toolbar defaults", () => {
    ensureDefaultStyles();
    const el = document.getElementById(STYLE_ID);
    expect(el).not.toBeNull();
    expect(el?.tagName).toBe("STYLE");
    expect(el?.parentElement).toBe(document.head);
    expect(el?.textContent).toContain(".sonr-iv-btn");
  });

  it("is idempotent — a second call does not add a duplicate", () => {
    ensureDefaultStyles();
    ensureDefaultStyles();
    expect(document.querySelectorAll(`#${STYLE_ID}`).length).toBe(1);
  });

  it("wraps every rule in :where() so consumer styles override with zero specificity", () => {
    ensureDefaultStyles();
    const css = document.getElementById(STYLE_ID)?.textContent ?? "";
    expect(css).toContain(":where(");
    // Every class selector lives inside a :where() (zero specificity). Strip the
    // :where(...) groups and no `.sonr-` selector should remain at top level.
    const outsideWhere = css.replace(/:where\([^)]*\)/g, "");
    expect(outsideWhere).not.toContain(".sonr-");
  });

  it("prepends the style so consumer stylesheets (later in <head>) win ties", () => {
    const consumer = document.createElement("style");
    document.head.appendChild(consumer);
    ensureDefaultStyles();
    const injected = document.getElementById(STYLE_ID)!;
    // Injected default comes before the pre-existing consumer style in source order.
    expect(
      injected.compareDocumentPosition(consumer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    consumer.remove();
  });

  it("respects the data-sonr-no-default-styles opt-out", () => {
    document.documentElement.setAttribute("data-sonr-no-default-styles", "");
    ensureDefaultStyles();
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });
});

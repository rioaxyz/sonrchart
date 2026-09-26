import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Icon,
  DrawIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  UnlockIcon,
  CopyIcon,
  FrontIcon,
  BackIcon,
  ClearIcon,
  UndoIcon,
  RedoIcon,
  GearIcon,
  CameraIcon,
  CalendarIcon,
  ObjectsIcon,
  PencilIcon,
  ZoomInIcon,
  ZoomOutIcon,
  FitIcon,
  RealtimeIcon,
  CandleIcon,
} from "../src/icons";
import { DEFAULT_DRAWING_TOOLS, EXTENDED_DRAWING_TOOLS } from "../src/drawings";
import type { DrawingTool } from "../src/types";

const UI_ICONS = [
  EyeIcon, EyeOffIcon, LockIcon, UnlockIcon, CopyIcon, FrontIcon, BackIcon, ClearIcon,
  UndoIcon, RedoIcon, GearIcon, CameraIcon, CalendarIcon, ObjectsIcon, PencilIcon,
  ZoomInIcon, ZoomOutIcon, FitIcon, RealtimeIcon, CandleIcon,
];

function svgOf(el: HTMLElement): SVGSVGElement {
  const svg = el.querySelector("svg");
  if (!svg) throw new Error("no <svg> rendered");
  return svg as unknown as SVGSVGElement;
}

describe("Icon primitive (Lucide conventions)", () => {
  it("draws on a 24×24 grid with a 2px round currentColor stroke and no fill", () => {
    const { container } = render(<Icon><path d="M4 4h16" /></Icon>);
    const svg = svgOf(container);
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke-width")).toBe("2");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders at 15px by default and honors size / strokeWidth overrides", () => {
    const { container: a } = render(<Icon><path d="M0 0" /></Icon>);
    expect(svgOf(a).getAttribute("width")).toBe("15");
    const { container: b } = render(<Icon size={24} strokeWidth={1.5}><path d="M0 0" /></Icon>);
    expect(svgOf(b).getAttribute("width")).toBe("24");
    expect(svgOf(b).getAttribute("stroke-width")).toBe("1.5");
  });
});

describe("icon set", () => {
  it("every UI icon is a 24-grid svg with drawn content", () => {
    for (const IconCmp of UI_ICONS) {
      const { container } = render(<IconCmp />);
      const svg = svgOf(container);
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg.getAttribute("stroke-linecap")).toBe("round");
      expect(svg.childElementCount).toBeGreaterThan(0);
    }
  });

  it("DrawIcon renders a glyph for every default + extended drawing tool", () => {
    const tools = [...DEFAULT_DRAWING_TOOLS, ...EXTENDED_DRAWING_TOOLS].map((t) => t.tool);
    for (const tool of tools) {
      const { container } = render(<DrawIcon tool={tool} />);
      const svg = svgOf(container);
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg.childElementCount).toBeGreaterThan(0);
    }
  });

  it("every extended drawing tool has a dedicated glyph (not the 1-line fallback)", () => {
    for (const { tool } of EXTENDED_DRAWING_TOOLS) {
      const { container } = render(<DrawIcon tool={tool} />);
      // The fallback renders a single <line>; every extended glyph draws more.
      expect(svgOf(container).childElementCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("DrawIcon falls back to a segment glyph for an unknown tool", () => {
    const { container } = render(<DrawIcon tool={"totally-unknown" as DrawingTool} />);
    const svg = svgOf(container);
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.querySelector("line")).not.toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { resolveShortcut, isEditableTarget, type ShortcutAction } from "../src/keyboard";

// Build a minimal KeyboardEvent-like object for the pure resolver.
function ev(key: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }> = {}): KeyboardEvent {
  return { key, metaKey: false, ctrlKey: false, shiftKey: false, ...mods } as KeyboardEvent;
}

describe("resolveShortcut", () => {
  it("maps Escape (and Esc) to escape", () => {
    expect(resolveShortcut(ev("Escape"))).toBe<ShortcutAction>("escape");
    expect(resolveShortcut(ev("Esc"))).toBe("escape");
  });

  it("maps Cmd/Ctrl+Z to undo", () => {
    expect(resolveShortcut(ev("z", { metaKey: true }))).toBe("undo");
    expect(resolveShortcut(ev("z", { ctrlKey: true }))).toBe("undo");
    expect(resolveShortcut(ev("Z", { ctrlKey: true }))).toBe("undo");
  });

  it("maps Cmd/Ctrl+Shift+Z and Ctrl+Y to redo", () => {
    expect(resolveShortcut(ev("z", { metaKey: true, shiftKey: true }))).toBe("redo");
    expect(resolveShortcut(ev("Z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(resolveShortcut(ev("y", { ctrlKey: true }))).toBe("redo");
    expect(resolveShortcut(ev("y", { metaKey: true }))).toBe("redo");
  });

  it("maps bare Delete/Backspace to delete", () => {
    expect(resolveShortcut(ev("Delete"))).toBe("delete");
    expect(resolveShortcut(ev("Backspace"))).toBe("delete");
  });

  it("does NOT treat Cmd/Ctrl+Delete/Backspace as the delete shortcut", () => {
    expect(resolveShortcut(ev("Delete", { metaKey: true }))).toBeNull();
    expect(resolveShortcut(ev("Backspace", { ctrlKey: true }))).toBeNull();
  });

  it("maps Cmd/Ctrl+C to copy and Cmd/Ctrl+V to paste (#35)", () => {
    expect(resolveShortcut(ev("c", { metaKey: true }))).toBe("copy");
    expect(resolveShortcut(ev("C", { ctrlKey: true }))).toBe("copy");
    expect(resolveShortcut(ev("v", { metaKey: true }))).toBe("paste");
    expect(resolveShortcut(ev("V", { ctrlKey: true }))).toBe("paste");
    // Bare c/v are not shortcuts.
    expect(resolveShortcut(ev("c"))).toBeNull();
    expect(resolveShortcut(ev("v"))).toBeNull();
  });

  it("returns null for a plain letter or unmapped key", () => {
    expect(resolveShortcut(ev("z"))).toBeNull(); // no modifier
    expect(resolveShortcut(ev("a", { metaKey: true }))).toBeNull();
    expect(resolveShortcut(ev("Enter"))).toBeNull();
  });
});

describe("isEditableTarget", () => {
  it("is true for input/textarea/select and contenteditable", () => {
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(document.createElement("select"))).toBe(true);
    const ce = document.createElement("div");
    Object.defineProperty(ce, "isContentEditable", { value: true });
    expect(isEditableTarget(ce)).toBe(true);
  });

  it("is false for non-editable elements and null", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

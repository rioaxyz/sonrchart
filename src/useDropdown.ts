import { useCallback, useEffect, useRef, useState } from "react";

// Shared behavior for the toolbar's portal dropdowns (indicators, candle type):
// anchor a body-portaled panel to a trigger in viewport coords (escaping the
// toolbar's overflow clip and any transformed ancestor), and close on outside
// click / Escape while repositioning on scroll+resize.
export function useDropdown() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
  }, []);

  const openMenu = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const toggle = useCallback(() => {
    setOpen((o) => {
      if (!o) place();
      return !o;
    });
  }, [place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const reflow = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reflow);
    window.addEventListener("scroll", reflow, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow, true);
    };
  }, [open, place]);

  return { open, setOpen, openMenu, toggle, pos, triggerRef, panelRef };
}

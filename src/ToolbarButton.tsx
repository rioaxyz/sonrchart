import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ensureDefaultStyles } from "./defaultStyles";

// A consistently-styled toolbar button (issue #18) for custom header controls.
// It carries the same `sonr-*-btn` class the built-in toolbars use, so custom
// buttons match the rest of the chrome; the host styles everything via those
// classes (custom CSS) and drops these into <ChartToolbar>'s children slot.
export function ToolbarButton({
  active,
  children,
  className,
  ...rest
}: {
  active?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  useEffect(ensureDefaultStyles, []);
  return (
    <button
      type="button"
      className={`sonr-tb-btn${active ? " on" : ""}${className ? " " + className : ""}`}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  );
}

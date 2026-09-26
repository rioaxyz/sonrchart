import type { ReactNode, SVGProps } from "react";

// Homegrown icon system — a Lucide-style ("lucidified") set drawn for charting.
// Every icon is authored on a 24×24 grid with a 2px round stroke in currentColor
// (fill: none), mirroring the geometry rules at https://lucide.dev/icons/:
//   • 24×24 canvas, content within a ~2px margin
//   • 2px stroke, round caps + round joins
//   • strokes only (no fills) except a few deliberate solid accents
//   • inherits the button's text color via currentColor
//
// It renders at 15px by default to suit the toolbar chrome; callers can override
// `size` / `strokeWidth` (and pass through any SVG prop). This is the single
// primitive every icon in ./icons is built on.

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Rendered pixel size (square). Default 15. */
  size?: number;
  children?: ReactNode;
}

export function Icon({ size = 15, strokeWidth = 2, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
      {...rest}
    >
      {children}
    </svg>
  );
}

/** A solid endpoint dot (drawing-tool anchors), sized for the 24-grid. */
export const dot = (cx: number, cy: number) => <circle cx={cx} cy={cy} r="2" fill="currentColor" stroke="none" />;

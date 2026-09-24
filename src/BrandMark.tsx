import { useEffect, type ReactNode } from "react";
import { ensureDefaultStyles } from "./defaultStyles";

// Logo / branding placement (issue #45): a subtle, host-supplied brand mark
// pinned to a chart corner (TradingView-style). Provide an image via `src` or
// any content via `children` (a wordmark, an inline SVG, …). It's decorative by
// default — `pointer-events` are off so it never intercepts chart interaction —
// unless an `href` is given, which re-enables the link. Mount it inside the
// chart's positioned container.

export type BrandCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface BrandMarkProps {
  /** Image source for a logo, rendered as an <img> (sized by `height`). */
  src?: string;
  alt?: string;
  /** Brand content when not using `src` — a wordmark, inline SVG, etc. */
  children?: ReactNode;
  /** Corner placement within the positioned parent. Default "bottom-left". */
  position?: BrandCorner;
  /** Mark opacity (kept subtle by default). */
  opacity?: number;
  /** Optional link — wraps the mark in an anchor (opens in a new tab) and
   *  re-enables pointer events for it. */
  href?: string;
  /** Logo image height in px (only when `src` is set). Default 18. */
  height?: number;
  className?: string;
}

export function BrandMark({ src, alt = "", children, position = "bottom-left", opacity = 0.5, href, height = 18, className }: BrandMarkProps) {
  useEffect(ensureDefaultStyles, []);
  const content = src ? <img className="sonr-brand-img" src={src} alt={alt} style={{ height }} /> : children;
  return (
    <div className={`sonr-brand sonr-brand-${position}${className ? ` ${className}` : ""}`} style={{ opacity }}>
      {href ? (
        <a className="sonr-brand-link" href={href} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

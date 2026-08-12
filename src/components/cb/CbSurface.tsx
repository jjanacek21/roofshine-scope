import type { ReactNode } from "react";
import { CbPageTransition } from "./motion";
import { CbErrorBoundary } from "./CbErrorBoundary";


/**
 * Root wrapper for every Claim Buddy screen.
 * Sets the `data-cb` scope so the Claim Buddy design tokens and primitives apply,
 * and adds the page transition (fade + 8px slide).
 */
export function CbSurface({
  children,
  className = "",
  theme = "light",
}: {
  children: ReactNode;
  className?: string;
  /** Surface theme. Palette values live in the `[data-cb]` block of src/styles.css. */
  theme?: "dark" | "light";
}) {
  return (
    <div data-cb data-cb-theme={theme} className={`cb-root ${className}`}>
      <CbErrorBoundary>
        <CbPageTransition>{children}</CbPageTransition>
      </CbErrorBoundary>

    </div>
  );
}

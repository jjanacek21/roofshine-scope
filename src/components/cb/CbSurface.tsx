import { useEffect, type ReactNode } from "react";
import { CbPageTransition } from "./motion";
import { CbErrorBoundary } from "./CbErrorBoundary";

/**
 * Keeps `--cb-kb` in sync with the on-screen keyboard so fixed bottom docks
 * ride above it instead of hiding underneath, and scrolls the focused field
 * back into view once the keyboard settles.
 */
function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--cb-kb", `${Math.round(inset)}px`);
      if (inset > 120) {
        const el = document.activeElement as HTMLElement | null;
        if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    };
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    apply();
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      document.documentElement.style.setProperty("--cb-kb", "0px");
    };
  }, []);
}

/**
 * Root wrapper for every Claim Buddy screen.
 * Sets the `data-cb` scope so the Claim Buddy design tokens and primitives apply,
 * and adds the page transition (fade + 8px slide).
 */
export function CbSurface({
  children,
  className = "",
  theme = "dark",
}: {
  children: ReactNode;
  className?: string;
  /** Surface theme. Both values resolve to the same dark palette; the values
   *  live in the `[data-cb]` block of src/styles.css. */
  theme?: "dark" | "light";
}) {
  useKeyboardInset();
  return (
    <div data-cb data-cb-theme={theme} className={`cb-root ${className}`}>
      <CbErrorBoundary>
        <CbPageTransition>{children}</CbPageTransition>
      </CbErrorBoundary>
    </div>
  );
}

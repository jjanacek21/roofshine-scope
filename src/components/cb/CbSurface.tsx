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
 *
 * `skin` exists because these components are also used outside Claim Buddy.
 * Company Training is built from them but lives in the main app, and in the
 * Claim Buddy skin it read as a different product embedded in this one — 18px
 * corners and lifted cards against the app's flat 12px hairline ones. The
 * colours were never the issue; `[data-cb]` already aliases --brand and --bg.
 * `skin="app"` swaps the recipe and leaves Claim Buddy alone.
 */
export function CbSurface({
  children,
  className = "",
  theme = "light",
  skin = "cb",
}: {
  children: ReactNode;
  className?: string;
  /** Surface theme. Palette values live in the `[data-cb]` block of src/styles.css. */
  theme?: "dark" | "light";
  /** Which visual recipe: Claim Buddy's, or the surrounding app's. */
  skin?: "cb" | "app";
}) {
  useKeyboardInset();
  return (
    <div
      data-cb
      data-cb-theme={theme}
      data-cb-skin={skin}
      className={`cb-root ${className}`}
    >
      <CbErrorBoundary>
        <CbPageTransition>{children}</CbPageTransition>
      </CbErrorBoundary>
    </div>
  );
}

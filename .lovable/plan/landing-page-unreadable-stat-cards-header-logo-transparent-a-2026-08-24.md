# Landing page: unreadable stat cards, header logo, transparent animated logo

Three fixes on the gcn.claims marketing landing page. No new features.

## 1. The three stat bubbles are unreadable

Confirmed cause: two different sections define the same CSS class name.

- The hero (`Landing.tsx`) styles `.mkt-stat` as a dark translucent chip with near-white text.
- The "By the numbers" section further down (`HomeSections.tsx`) also defines `.mkt-stat`, but as a light card with a white surface and a green corner glow.

Both style blocks are injected globally, and the second one wins. So the hero chips get a white background while keeping their white text — the numbers and labels are effectively invisible, exactly as in the screenshot.

Fix: rename the hero's classes to their own namespace (`mkt-hero-stats` / `mkt-hero-stat`) so the two sections stop colliding. The hero chips go back to the dark translucent look, and the lower stat cards are untouched.

## 2. Remove "Claim Buddy" from the top header

Remove the small mark and the "Claim Buddy" wordmark from the sticky header on every marketing page. The nav, "Log in" and "Book a demo" stay where they are; the nav's existing "Home" link keeps the route to `/` reachable, and the nav shifts to the left edge of the header now that the brand block is gone.

## 3. Make the animated logo blend into the grid background

The hero logo is an MP4, and MP4 cannot carry real transparency — the black box around it is baked into the video. Fix it visually by blending the video into the hero instead: apply `mix-blend-mode: screen`, which drops pure black to fully invisible against the dark hero and leaves the green logo glowing over the grid lines. The same treatment goes on the reduced-motion poster image so both paths look identical.

If any faint edge of the video's checkerboard remains after blending, a soft radial mask around the mark cleans it up.

## Technical notes

- `src/pages/marketing/Landing.tsx` — rename hero stat classes; add `mix-blend-mode: screen` (plus `background: transparent`) to `.mkt-hero__logo` for both the `<video>` and the reduced-motion `<img>`.
- `src/components/marketing/HomeSections.tsx` — unchanged; it keeps `.mkt-stat` for the numbers section.
- `src/pages/marketing/MarketingShell.tsx` — delete the brand `<a>` (mark + wordmark) from the header, adjust the header flex layout so nav and right-side buttons stay balanced at both scrolled and unscrolled heights.

## Verification

Load the landing page signed out at desktop and mobile widths, screenshot the hero, and confirm: the three chips show readable numbers and labels, the header has no Claim Buddy mark or wordmark and the nav is still aligned, and the animated logo has no visible black box against the grid. Also confirm the lower "By the numbers" cards still look the same as before.

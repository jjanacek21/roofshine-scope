# Marketing logo: bleed from the header into the hero

Right now the animated logo sits inside the hero text column, and the header above it is logo-free. The goal is one logo that starts in the header bar and spills down over the edge into the dark hero, with no visible square, box or hard edge anywhere around it.

## What changes on the page

- The animated logo moves to the left side of the header bar, sized larger than the bar itself so its lower half hangs down into the hero below. It reads as one continuous mark crossing the boundary.
- The header stops clipping its contents and the line under it fades out behind the logo, so nothing cuts across the artwork.
- Behind the logo, a soft glow bridges the light header colour into the dark hero colour, so the two backgrounds meet under the mark instead of forming a visible seam.
- The top of the hero gets a gentle fade so the transition reads as a blend, not a step.
- The logo keeps its existing see-through playback (the black plate is already removed frame by frame), so there are no square edges from the video itself.
- The duplicate logo currently inside the hero text column is removed; the headline and copy move up to fill that space. The footer logo is untouched.
- On phones the logo scales down and overhangs less, so it never covers the menu button or the headline.
- Clicking the logo returns to the home view.
- Reduced-motion visitors and older browsers get the still transparent version in exactly the same position.

## Technical notes

- Markup: add the logo element to the header in `src/pages/marketing/ref/MarketingRefView.tsx`; drop the `.logo-wrap` block from the `home` view in `refMarkup.ts`.
- Runtime: `playLogo()` in `refRuntime.ts` targets the header element and no longer depends on the home view being mounted, so the luma-key mount happens once instead of on every `go("home")`.
- Styles in `marketing-ref.css`: `header.nav` gets `overflow:visible` and a lower stacking context than the logo; new `.nav-logo` rules for the oversized, negatively-offset mark, its radial bridge glow, and the `.hero` top mask; existing `.logo-anim`/`.logo-wrap` rules kept only where still referenced (footer).
- Sticky/`.stuck` state keeps the overhang proportional to the shrunken 58px bar.
- No content-table, CMS or asset changes; the current MP4/WebM/still assets are reused.

## Verification

Screenshot the marketing page at desktop and phone widths, scrolled to top and scrolled down (sticky header), to confirm no box edges and a clean blend.

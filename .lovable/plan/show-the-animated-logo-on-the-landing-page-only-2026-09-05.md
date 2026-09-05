# Show the animated logo on the landing page only

## What you're seeing

Claim Buddy's own screens were not touched — the only files changed were the three that build the public marketing site. The problem is that the marketing site shares one header across all of its pages, so once the logo went into that header it appeared on the landing page *and* on Product, Pricing, Resources and Blog.

## The fix

The animated logo appears in one place only: the globalcontractor.app landing page (home). Every other page — Product, Pricing, Resources, Blog, and the whole gcn.claims site — keeps the plain header exactly as it was before, with no logo, no glow and no extra spacing at the top of the page.

When you click from the landing page to Product or Pricing, the logo disappears with the header returning to normal; coming back to the landing page brings it back.

## Technical notes

- `refRuntime.ts`: keep the platform-only check, but also gate the logo move on the active view being `home`. Add/remove the `logo-in-header` classes on `#hdr` and the root inside `go()` so switching views toggles it, and move the logo element back to its hero wrapper (or hide the header slot) when leaving home.
- `marketing-ref.css`: no new rules needed — all bleed/glow/hero-padding rules are already scoped under `.logo-in-header`, which now only exists while home is active.
- `refMarkup.ts` and `site-images.ts`: unchanged.
- No changes to Claim Buddy app screens, routes, CMS content or assets.

## Verification

Screenshot the platform landing page, then Product and Pricing, plus the gcn.claims landing page, at desktop and phone widths to confirm the logo shows on the landing page only.

# Marketing site: animated logo, new header, futuristic type

## What you get

**1. The animated logo, with a truly transparent background**

The uploaded MP4 is a silver logo on a solid black plate. Today the site fakes transparency with a blend mode, which is why the black box keeps reappearing (and why the logo reverts whenever the CMS row points back at the old still image).

Instead, the hero logo becomes a small player that removes the black per pixel while it plays — every dark pixel becomes real transparency, so all you see is the silver mark, the silver lettering and the blue/green glow, over any background. No box, in either theme.

The same file is used in the footer plaque so the branding matches.

**2. Header without the logo**

- The Claim Buddy mark and wordmark come out of the header entirely.
- The nav links spread across the full width instead of clustering in the middle.
- Links get bigger, with more presence: raised glass pills with a soft inner highlight, a subtle lift on hover, and a blue/green light-up that follows the cursor across the row (the glow tracks the pointer, so dragging across the links lights each one in turn).
- The active page keeps a stronger lit state so you always know where you are.
- Log in / Book a demo stay on the right; mobile keeps the existing hamburger behaviour.

**3. Futuristic, still professional type**

Headings and UI move to **Space Grotesk** — clean, geometric, slightly technical. Body copy stays highly readable, and numbers/labels keep **JetBrains Mono**. Nothing gets sci-fi or hard to read.

## Technical notes

- Upload the MP4 through the CDN asset pipeline and reference it via a pointer file; do not commit the binary.
- New component renders the video off-screen and draws each frame to a canvas, zeroing alpha on near-black pixels (luma key with a soft threshold so the glow edges stay smooth). Autoplay muted, `playsInline`, loops. Reduced-motion and any decode failure fall back to the existing still logo.
- Replace `mix-blend-mode: screen` on `.logo-anim` / `.foot-logo` — it is what makes the plate visible over lighter surfaces.
- Make the CMS-backed brand entry accept a video URL so `claimbuddy_logo_animated` can never silently revert the hero to a static image; the pointer URL becomes the built-in default.
- Header edits live in `REF_HEADER` (`src/pages/marketing/ref/refMarkup.ts`) plus the `header.nav` / `nav.links` rules in `marketing-ref.css`. The cursor glow is a CSS custom property updated from a pointermove listener in `refRuntime.ts`, cleaned up on unmount.
- Load Space Grotesk with a `<link>` in the root route head and point `--font-sans` at it; no other palette or layout changes.

## Out of scope

No changes to page content, sections, pricing, colors, or the app behind the login.

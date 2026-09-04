# Swap the marketing page logo to the new GCN App animation

## What you get

The hero logo on the marketing site (and the footer plaque, which shares it) becomes your new uploaded animation — the metallic GCN rings with the green/blue glow. The black background of the video is removed per-pixel as it plays, so the logo blends straight into the page background with no black box, in any theme. This reuses the exact keying pipeline already built for the current logo (`logoVideo.ts`), so no new rendering code is needed.

## Steps

1. **Upload the new video to the CDN asset pipeline** from the uploaded MP4 (`generated_video.mp4`, 1280x720, ~15s, black plate) — new pointer file `src/assets/gcn-app-logo-anim.mp4.asset.json`. Also transcode a WebM (VP9) copy with ffmpeg for smaller/faster playback and upload it too.
2. **Point the marketing site at it**: update `BRAND_LOGO_VIDEO` / `BRAND_LOGO_VIDEO_WEBM` in `src/lib/site-images.ts` to the new asset URLs. This is the single source the hero (`#logoAnim`), footer (`#footLogo`), and `MarketingRefView.tsx` all read, so one change covers everywhere the animated logo shows.
3. **Blend tuning**: the luma key (near-black → transparent, soft threshold for glow edges) already does the blending. I'll verify against the actual page backgrounds with a screenshot and nudge the LO/HI thresholds in `logoVideo.ts` only if the dark green glow edges fringe.
4. **Fallback still**: extract a clean frame (the "The Global Contractor Network" end-card frame) as a WebP and use it as the reduced-motion / decode-failure fallback so the logo never disappears.
5. **Verify**: load the marketing landing page in the browser, screenshot the hero and footer in place, confirm no black plate and no halo, and confirm the build is clean.

## Out of scope

No changes to page content, layout, header/nav, colors, or anything behind the login. The Claim Buddy in-app branding is untouched.

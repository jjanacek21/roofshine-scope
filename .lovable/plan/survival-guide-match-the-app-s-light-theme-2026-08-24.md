# Survival Guide: match the app's light theme

The Survival Guide is a self-contained HTML page loaded in an iframe on both `/survival-guide` (platform) and `/cb/survival-guide` (Claim Buddy). It still uses its original dark navy palette with blue accents, so it looks like a different product from the rest of the app.

## What changes

- Recolor the guide to the app theme: near-white background, black text, green accents, light hairline borders, soft shadows.
- Cards, sidebar nav, sticky header, search field, chips/badges, code and script blocks all move to light surfaces with readable contrast.
- Status colors (good / warning / hot) map to the app's success, warning, and danger tones instead of the neon dark-mode versions.
- Highlight and callout blocks get light tinted fills instead of dark ones.
- Typography stays as-is; only colors, borders, and shadows change. No content, structure, search, or navigation behavior is touched.
- The two iframe wrappers that force a dark `#0a0a0f` backdrop switch to the app's card surface so there's no dark frame around the light page.

## Technical notes

- Edit the `:root` custom-property block at the top of `public/survival-guide/index.html` and the handful of hardcoded hex/rgba values elsewhere in that file (header gradient, code block backgrounds, highlight tints, button gradient, shadow).
- New values mirror `src/styles.css`: `--bg #f6f7f9`, panels `#ffffff`, borders `#dfe3e8` / `#c4cad2`, text `#0b0b0c` / `#475569`, accent `#15803d` with `#116331` hover, success `#15803d`, warning `#b45309`, danger `#dc2626`, shadow `0 4px 20px rgba(15,23,42,0.08)`.
- The guide is a standalone static file so it cannot import the app's CSS variables; values are copied literally to stay in sync with the tokens.
- Update the iframe container background in `src/routes/_app.survival-guide.tsx` and `src/routes/cb.survival-guide.tsx` from `#0a0a0f` to `var(--bg-card)`.

# Collapse the storm intel controls behind a gear button

Right now the Storm intel map always shows a full control panel in the top-left (time range, hail/wind toggles, wind bands, hail bands, saved properties). On a phone it covers most of the map.

## What changes

- Add a small round gear button in the top-left corner of the storm map.
- The controls panel is collapsed by default: only the gear shows, so the map is fully visible.
- Tapping the gear slides/fades the panel open; tapping it again (or the small close X in the panel header) collapses it back.
- On phones the open panel is width-capped so it never spans the whole screen, and it scrolls internally if the band lists are long.
- On desktop the panel starts open, since space isn't tight there.
- A tiny loading spinner stays visible on the gear while storm data is fetching, so the collapsed state still signals activity.

Nothing about the data, layers, time ranges, or saved properties behavior changes — only how the panel is shown and hidden.

## Technical notes

- File: `src/components/storm/StormSwathMap.tsx`, the "Controls + legend" block (currently an always-rendered absolutely positioned div at top-left).
- Add local state `controlsOpen`, initialized from a mobile check (`useIsMobile` from `src/hooks/use-mobile`): closed on mobile, open on desktop.
- Render a gear toggle button (`Settings` icon from lucide-react) at `absolute top-4 left-4 z-10`, matching existing card tokens (`var(--bg-card)`, `var(--border)`), 40px tap target.
- When open, render the existing panel content unchanged, offset below the gear, with `max-w-[calc(100vw-2rem)]`, `max-h-[70%]`, `overflow-auto`, and a header row containing the title and a close button.
- Keep all existing state and handlers as-is; this is a presentation-only wrap.

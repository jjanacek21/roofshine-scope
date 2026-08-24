# Door to Door map: one property panel, cleaner storm controls

Three changes to the Claim Buddy map, all on the map screen only.

## 1. Storm controls collapse behind a gear

Today the Storm intel controls (time range, hail/wind toggles, wind bands, hail bands, saved properties) are always open in the top-left and cover most of a phone screen.

- Add a small round gear button in the top-left corner of the storm map.
- Collapsed by default on phones, open by default on desktop where there's room.
- Tapping the gear opens the panel; tapping it again, or the close X in the panel header, collapses it.
- Open panel is width-capped so it never spans the whole screen and scrolls internally when the band lists are long.
- The loading spinner stays visible on the gear so the collapsed state still shows when storm data is fetching.

## 2. Clicking a pin in Storm intel opens the canvass property panel

Right now storm mode has its own small point popup, separate from the canvass panel. Clicking a house in Storm intel will open the same full property panel used in Canvass mode — disposition buttons, resident details, insurance and date of loss, storm activity, AI mailer, roof measurement, and Start inspection — so both modes behave the same. The map stays on storm intel behind the panel; closing the panel returns to the storm view.

## 3. Canvass pin shows the full recent storm history

The property panel currently shows max hail and peak wind with only the three most recent dates, and no message when nothing is on record.

- List every recent hail and wind event returned for that house, newest first, each with its date and size/speed, in a scrollable block so long lists don't push the buttons off screen.
- When there are no events on record, say so plainly: "No hail reported for this address" and "No 60+ mph winds reported for this address", instead of leaving a blank column.
- Keep the max hail / peak wind headline numbers as they are.

## Technical notes

- `src/components/storm/StormSwathMap.tsx`
  - Wrap the top-left "Controls + legend" block in a `controlsOpen` state, initialised from `useIsMobile()` (closed on mobile, open on desktop). Gear toggle uses the `Settings` lucide icon with existing `var(--bg-card)` / `var(--border)` tokens and a 40px tap target. Open panel gets `max-w-[calc(100vw-2rem)]`, `max-h-[70%]`, `overflow-auto`, plus a header row with a close button. Presentation-only; no state or layer logic changes.
  - Add an optional `onPointSelect?: (p: { lat: number; lng: number; footprint?: [number,number,number,number] | null }) => void` prop. When supplied, `setPointRef.current` calls it instead of setting internal `point`, so the internal report popup and its mailer stay dead code for this surface (standalone Storm Intelligence page keeps current behavior since it won't pass the prop).
- `src/routes/cb.map.tsx`: pass `onPointSelect={(p) => setSelected(p)}` to `StormSwathMap`, and render the existing `CbMapPropertyPanel` overlay for both modes rather than only `mode === "canvass"`.
- `src/components/claim-buddy/map/CbMapPropertyPanel.tsx`: drop the `.slice(0, 3)` in `topHail` / `topWind`, render full lists inside a `max-h-40 overflow-auto` container each, and add the empty-state copy when a list is empty and the query is not loading.

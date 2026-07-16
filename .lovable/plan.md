## Goal

Make `src/components/storm/StormSwathMap.tsx` self-healing so the map never gets stuck as a black canvas. No visual, data, or RPC changes.

## Refactor

Restructure the map init effect around a single `initMap()` function plus an idempotent `setupLayers(map)` so every recovery path takes the exact same setup route.

### 1. Init guard
- Keep `mapRef` as the single source of truth (no `useState` for the map).
- `initMap()` early-returns if `mapRef.current` is not null.
- Effect cleanup: `map.remove(); mapRef.current = null; readyRef.current = false; setStyleReady(false);` so StrictMode's double mount re-inits cleanly.

### 2. Load watchdog (8s, one auto-retry, then error UI)
- Track `retryCountRef` (0 → 1 → give up).
- On map creation start `setTimeout(8000)`.
- On `map.on('load', …)` clear the timer.
- On timeout: if `retryCountRef.current === 0`, `console.warn`, remove map, null the ref, bump counter, call `initMap()` again. If already retried, set `initError` state → renders overlay with message + "Reload map" button that resets `retryCountRef` and calls `initMap()`.

### 3. WebGL context recovery
- After `map.load`, attach `canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); … })`.
- Handler: remove the map, null the ref, call `initMap()`. `setupLayers` re-adds everything from the current refs (`hailRef`, `windRef`, `terrRef`), so state fully restores.
- Also handle `webglcontextrestored` as a no-op safety net (we already re-created).

### 4. Idempotent `setupLayers(map)`
- Extract the entire `map.on('load', …)` body (sources, layers, click/hover handlers, popup, `readyRef.current = true`, applying data from refs, `setStyleReady(true)`) into `function setupLayers(map)`.
- Before adding each source/layer, check `map.getSource(id)` / `map.getLayer(id)` and skip if present — safe for repeated calls.
- The load handler and every re-init path call `setupLayers(map)` from `map.on('load')` — never directly — so style is always ready first.

### 5. Resize safety
- Keep existing `ResizeObserver` on the container, calling `map.resize()`. Ensure it's disconnected on cleanup and re-attached inside `initMap()` (so re-created instances also get it). Track the observer in a ref for cleanup.

### 6. Error logging
- `map.on('error', (e) => console.error('[StormMap] map error:', e?.error ?? e));` inside `initMap()`, before `load`.

## Overlay behavior (visual reuses existing overlay pattern)

- Existing "Loading basemap…" overlay stays exactly as-is.
- New `initError` state renders the same overlay pill styling with red text + a small `Button` labeled "Reload map" that: `setInitError(null); retryCountRef.current = 0; initMap();`.
- No new colors, fonts, or layout changes.

## Non-goals

- No changes to hail/wind/territories RPC calls, query keys, staleTime.
- No changes to legend, popup HTML, layer paint properties, auto-pan logic, or the quick-jump `flyTo` effect.
- No changes outside `StormSwathMap.tsx`.

## Verification

After implementation, load the published `/storm-intelligence` preview via Playwright, confirm the basemap streets render, then simulate context loss with `map.getCanvas().getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()` in devtools console and confirm the map self-recovers with swaths still visible.

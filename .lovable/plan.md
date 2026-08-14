# Accurate, simplified Claim Buddy roof measurement

## Goal
Make the measurement screen follow one dependable sequence:

```text
Drop one pin per roof color/structure
→ AI traces one outer footprint for each pin
→ review the highlighted footprints
→ drag or tap corners to correct them
→ lock the footprints
→ draw all interior lines
→ label perimeter edges and drawn lines
→ save measurements and continue
```

## Implementation

1. **Add pin-sampled vision tracing**
   - Capture a high-resolution, north-up satellite image around each dropped pin.
   - Treat each pin as its own roof-color sample: pin 1 targets the main roof, pin 2 can target a different-color flat roof, and later pins can target sheds or detached structures.
   - Send the image, pin location, and existing building/solar outline to the server-side vision tracer.
   - Instruct the tracer to return a single outer roof boundary for that pin, distinguish roof material from similar patios/driveways, account for shadows, and use visible gutters/fascia as boundary evidence.
   - Validate and convert the returned image-space polygon into map coordinates. Reject invalid or implausible traces instead of silently producing a square.
   - Keep the existing building/solar footprint as a fallback only when it is a real outline; clearly return a measurement failure when neither method produces usable geometry.

2. **Preserve one highlighted footprint per pin**
   - Stop merging or replacing structures after a multi-pin run.
   - Persist the raw detected outline separately from the user-edited outline so the confidence/reference overlay remains meaningful.
   - Make the current editable footprint fill and outline the primary map layers, with the AI reference shown only on demand.
   - Repaint layers after map/style readiness changes so the highlight cannot disappear on mobile.

3. **Simplify the mobile controls**
   - Replace the overlapping button cloud with a compact state-based toolbar:
     - Before measuring: `Drop pin`, `Measure roofs`, `Clear pins`.
     - Footprint review: `Adjust footprint`, `Lock footprint`.
     - Locked footprint: `Draw lines`, `Label lines`, `Unlock`.
   - Move undo/redo/reset and AI-reference visibility into one secondary menu.
   - Remove the separate refine mode; corner dragging and midpoint insertion remain directly available during footprint review.

4. **Make draw-first, label-later reliable**
   - Snap each new line endpoint to the nearest detected footprint vertex or boundary when it falls within a forgiving screen-space radius; preserve free placement for interior ridge/hip/valley endpoints.
   - Save every finished line immediately as `unlabeled`, keep it visibly rendered, clear only the temporary draft, and leave line drawing active for the next line.
   - Add a dedicated `Label lines` mode where tapping a completed line or perimeter segment opens the type picker.
   - Keep completed unlabeled lines visible with their length until they are labeled.

5. **Correct totals and saving**
   - Calculate roof area from the locked footprint, perimeter from all outer edges, and ridge/hip/valley/flashing from labeled drawn lines.
   - Continue deriving drip edge and starter from labeled eave + rake, falling back to the full locked perimeter until perimeter labels are complete.
   - Save all structures, perimeter labels, drawn lines, and edited geometry before moving to takeoff.

## Technical details

- Keep the existing authenticated Claim Buddy server-function boundary and shared GlobalContractor measurement persistence.
- Add a server-only vision helper; the client will never receive the AI key or map imagery credential.
- Use `openai/gpt-5.6-sol` for the server-side multimodal trace and require structured polygon output with normalized image coordinates and per-edge confidence.
- Validate polygon closure, vertex count, area, pin containment/proximity, self-intersections, and geographic bounds before accepting the trace.
- Add reusable geometry helpers for nearest boundary projection and endpoint snapping.
- Verify on a mobile viewport with two different roof pins: both fills remain visible, corners move, lock works, multiple lines persist after finishing, each line and perimeter edge can be labeled, and saved totals survive reload.
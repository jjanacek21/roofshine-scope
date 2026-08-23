# Fix "No satellite roof data for this address" on every roof

## What's actually happening

Confirmed from the live server logs: every roof trace is being rejected by the AI vision service with a 400 error:

```text
Unsupported value: 'minimal' is not supported with the 'gpt-5.6-sol' model.
Supported values are: 'none', 'low', 'medium', 'high', 'xhigh', and 'max'.
```

The tracer asks the model for "minimal" thinking effort — a setting that was valid before but this model no longer accepts. So the trace returns nothing on every single house, and because the code deliberately refuses to fall back to a fake rectangle, the screen ends with "No satellite roof data for this address — trace it or type it in."

Nothing is wrong with the address, the pin, the map, or the credits.

## The fix

1. Ask the model for the lowest supported effort level (`low`) instead of the rejected `minimal`, so traces run again at the same speed target.
2. Log the gateway's error message into the failure reason so the screen can say "the roof tracer is unavailable" instead of implying the address has no satellite data — a rejected request is not the same as a house with no coverage.
3. Verify on the QA account: drop a pin, tap Measure roof, confirm a real outline with orange highlight comes back, and confirm the server logs show no gateway 400.

No change to the measurement wizard itself: pin drop, trace, corner refinement, footprint save, line drawing and labeling all stay exactly as they are.

## Technical detail

- `src/lib/roof-vision-trace.server.ts`: `reasoning: { effort: "minimal" }` → `"low"`; keep the existing 40s timeout and 30-minute trace cache.
- `src/lib/cb-measure.server.ts`: distinguish a tracer/gateway error from genuine no-coverage in `firstFailure`, and surface it in `src/routes/cb.job.$id.measure.tsx`'s toast wording.

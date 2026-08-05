# Remove the "AI Condition" tab from Measurements

The measurements panel currently has five tabs: Manual Entry, Mapbox Draw, AI Measurements, AI Condition, Upload Report. The "AI Condition" tab duplicates what the "Analyze property" button already does from the photos panel.

## Change

- Remove the "AI Condition" tab (label, icon, tab type, disabled rule, and its rendered panel) from the measurements panel.
- Leave the "Analyze property" button (photo-based AI analysis) exactly as it is — it stays the single entry point for AI condition analysis.
- Keep the underlying condition-analysis component and API route in the codebase so nothing else that uses them breaks; only the tab is removed from the UI.

## Technical detail

- `src/components/roof/RoofMeasurementPanel.tsx`: drop `"condition"` from the `Tab` union, `TAB_LABELS`, the `disabled` check, and the `{tab === "condition" && ...}` block; remove the now-unused `ConditionAITab` import.
- `src/components/jobs/PropertyAnalysisPanel.tsx` (the "Analyze property" button) is untouched.

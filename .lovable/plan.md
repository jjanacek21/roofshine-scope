
# AI Assistant Chatbot + Order Form Auto-Populate

A floating AI copilot available on every page. Users type or speak; it answers navigation/how-to questions, and can execute actions in the app (create leads, jobs, estimates, order forms) via tool calls. Plus: auto-fill order form fields from saved roof measurements and estimate.

## User Experience

**Floating bubble** (bottom-right, every page inside `_app`):
- Collapsed: brand-styled circular button with mic + chat icon
- Expanded: 400px wide chat panel with message history, mic button, text input, and a "Voice Mode" toggle
- Voice Mode ON: mic auto-listens after each assistant reply; user talks, transcript appears live, auto-sends on pause
- Assistant responses render markdown; tool calls render as compact "Action" cards ("Created lead for Jason Smith →" with a link to the record)
- Follow-up questions from the AI appear in chat — user answers by voice or text

**Persistence:** Save threads in Lovable Cloud (per user). This lets the assistant remember prior context ("the Jason Smith lead we just made") and keeps chat history across devices. New chat / thread list accessible from a small menu in the panel header.

## Capabilities (Tool Calls)

The assistant uses AI SDK tool calling. Tools available:

1. **navigate** — go to any route (`/leads`, `/jobs/:id/estimate`, etc.)
2. **explain_feature** — return help text from a static knowledge map of app sections
3. **create_lead** — name, address (geocoded via Mapbox), phone, email, roof type, damage notes, claim info, estimated value
4. **update_lead** — patch a lead by id
5. **create_job_from_lead** — convert a lead to a job
6. **add_estimate_line_items** — voice-driven line item add (matches against `line_item_master` via existing Gemini matcher)
7. **analyze_photos_for_estimate** — reuse existing `/api/analyze-job-photos` pipeline; user uploads photos through the chat
8. **populate_order_form** — pull measurements + estimate for a job and write draft inputs (squares, hip/ridge LF, perimeter LF, valley LF, eave LF, rake LF, pitch)
9. **search_leads / search_jobs** — find records by name/address for follow-up actions
10. **request_info** — assistant asks the user for missing fields; input flows back through the same chat

For any mutation tool, the assistant confirms in chat ("I created lead Jason Smith at 2847 NE 2nd Ave — [Open](/leads/xxx)"). If a required field is missing, it asks in chat rather than guessing.

## Voice Input

Browser Web Speech API (`SpeechRecognition`):
- Push-to-talk button + Voice Mode toggle
- Continuous mode with interim results shown live in the composer
- Auto-submit on 1.5s silence when Voice Mode is on
- Graceful fallback + toast when browser doesn't support it (Safari desktop)
- Assistant text replies can optionally speak back via `SpeechSynthesis` (toggle in panel header, off by default)

## Order Form Auto-Populate

New helper `deriveOrderFormInputs(jobId)` (server function) that:
1. Reads latest `roof_measurements` + `roof_sections` for the job
2. Reads active estimate line items
3. Maps totals → template input keys used by `job_order_drafts.inputs`:
   - `squares` = total_area / 100
   - `hip_ridge_lf`, `ridge_lf`, `hip_lf`, `valley_lf`, `eave_lf`, `rake_lf`, `perimeter_lf`, `step_flashing_lf`, `pitch`
4. Merges into existing draft `inputs` (never overwrites a value the user manually edited — tracked via a new `manual_input_keys` array on the draft)

Wired in two places:
- Auto-run on first visit to `/jobs/:id/order-form` when draft `inputs` is empty
- "Auto-fill from measurements" button in the order-form header (always available; shows diff before applying)
- Also callable by the assistant via `populate_order_form` tool

## Technical Details

**Data model (new migration):**
- `assistant_threads` (id, user_id, company_id, title, created_at, updated_at)
- `assistant_messages` (id, thread_id, role, parts jsonb, tool_calls jsonb, created_at)
- RLS: `user_id = auth.uid()` on both; standard GRANTs
- Add `manual_input_keys text[] default '{}'` to `job_order_drafts`

**Backend:**
- `src/routes/api.assistant-chat.ts` — TanStack server route, streams via AI SDK `streamText` + `toUIMessageStreamResponse`
- Model: `google/gemini-3-flash-preview` (fast, multimodal, cheap, supports tool calling)
- Provider: Lovable AI Gateway via existing helper (create `src/lib/ai-gateway.server.ts` if missing)
- Tools defined in `src/lib/assistant-tools.server.ts` using AI SDK `tool()` + zod schemas; each tool uses `requireSupabaseAuth` context via a shared helper that receives the current user's Supabase client
- `stopWhen: stepCountIs(50)` for multi-step tool loops
- Persist final assistant message in `onFinish`

**Frontend:**
- `src/components/assistant/AssistantBubble.tsx` — floating launcher
- `src/components/assistant/AssistantPanel.tsx` — chat UI using AI Elements (`conversation`, `message`, `prompt-input`, `tool`, `shimmer`)
- `src/components/assistant/ThreadList.tsx` — sidebar of threads inside the panel
- `src/hooks/useVoiceInput.ts` — Web Speech API wrapper (start/stop, interim/final transcripts, silence detection)
- `src/hooks/useAssistantThreads.ts` — thread CRUD via server fns
- Mount `<AssistantBubble />` in `src/routes/_app.tsx` so it appears on all authenticated pages (not on public routes, login, or /card)
- Tool result renderer: navigation actions become clickable links (using `useNavigate`), record creations show a small card with the created entity + "Open" link

**Server functions (`src/lib/assistant.functions.ts`):**
- `listThreads`, `createThread`, `getThreadMessages`, `deleteThread`
- `deriveOrderFormInputs(jobId)` — used by both the button and the tool

**Existing capability reuse:**
- Photo → line items: existing `/api/analyze-job-photos` route
- Address geocoding: existing Mapbox integration
- Line item matching: existing Gemini matcher already wired in estimates

## Files to Create

- `supabase/migrations/*_assistant_threads.sql`
- `src/lib/ai-gateway.server.ts` (if not already present)
- `src/lib/assistant-tools.server.ts`
- `src/lib/assistant.functions.ts`
- `src/lib/order-form-derive.ts` + `src/lib/order-form-derive.functions.ts`
- `src/routes/api.assistant-chat.ts`
- `src/components/assistant/AssistantBubble.tsx`
- `src/components/assistant/AssistantPanel.tsx`
- `src/components/assistant/ThreadList.tsx`
- `src/components/assistant/ToolResultCard.tsx`
- `src/hooks/useVoiceInput.ts`
- `src/hooks/useAssistantThreads.ts`

## Files to Modify

- `src/routes/_app.tsx` — mount `<AssistantBubble />`
- `src/routes/_app.jobs.$id.order-form.tsx` — auto-fill on empty; add "Auto-fill from measurements" button
- `src/hooks/useOrderForm.ts` — extend draft type with `manual_input_keys`
- Install AI Elements: `bun x ai-elements@latest add conversation message prompt-input shimmer tool`

## Out of Scope (can add later)

- Server-side transcription fallback for Safari desktop
- Multi-tenant admin dashboard for assistant analytics
- Automatic photo upload from voice ("take a picture" doesn't trigger camera — user still uploads via chat attach button)

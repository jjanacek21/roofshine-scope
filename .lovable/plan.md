

## Fix: wire "New Job" buttons to the existing wizard

The `/jobs/new` 4-step wizard route is fully built, but two "New Job" buttons still call a stub `toast.info("New Job wizard — coming soon")` instead of navigating to it.

### Changes

**`src/components/layout/Topbar.tsx`** (line 87-90)
- Replace the `<button onClick={toast}>` with a TanStack `<Link to="/jobs/new">` (keep the same `btn-brand` styling and Plus icon).
- Remove the now-unused `toast` import if nothing else in the file uses it.

**`src/routes/_app.index.tsx`** (line 162-165)
- Same fix: swap the placeholder button for `<Link to="/jobs/new">`.

That's it — one-line wiring fix in two files. The wizard itself, the route, and the navigation flow already work.


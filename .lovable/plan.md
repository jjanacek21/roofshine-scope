## Diagnosis

`src/routes/_app.card.tsx` builds the QR + share link from `window.location.origin`:

```
const cardUrl = slug ? `${window.location.origin}/c/${slug}` : "";
```

When the rep is using the editor preview, that origin is `id-preview--…lovable.app`, which is gated behind a Lovable login. So the QR encodes a URL that demands a Lovable account before it ever reaches `/c/<slug>`. The public route itself is fine — visiting it on the live domain shows the card with no login.

## Fix

Always generate share URLs from the project's **public** host, never from `window.location.origin`.

### Steps

1. **Add a tiny helper** `src/lib/publicUrl.ts` exporting `getPublicCardUrl(slug)` that:
   - Returns `https://globalcontractor.app/c/<slug>` whenever the current host is `id-preview--*.lovable.app`, `*-dev.lovable.app`, `lovable.dev`, `localhost`, or any non-production host.
   - Otherwise returns `${window.location.origin}/c/<slug>` (so the live custom domain and `roofshine-scope.lovable.app` keep using themselves).
   - Production host constant: `https://globalcontractor.app` (the project's primary custom domain).

2. **Use the helper** in `src/routes/_app.card.tsx`:
   - Replace the `cardUrl` line with `getPublicCardUrl(slug)`.
   - Show the resolved URL in the share panel so the rep can see exactly what their QR points to.

3. **Audit other share surfaces** for the same pattern and switch them to the helper:
   - SMS / Email share buttons in the share panel (they currently embed `cardUrl`).
   - Any "copy link" actions.
   - The "View card" link in the header — keep that one as a relative `/c/<slug>` so it opens in the rep's current context (preview or prod), since the rep is already authenticated wherever they are.

4. **Regenerate the QR** automatically whenever `cardUrl` changes (already happens via the existing `useEffect`), so the rep doesn't have to take any action — next time the page loads, the QR will encode the public URL.

## Out of scope

- Multi‑tenant per‑company custom domains for the public card (current company has only `globalcontractor.app` configured as the public host).
- Short‑link service (e.g. `gcn.app/c/<slug>` redirect). Can be added later if URL length matters for printed QR codes.
- Changing how the published site itself is hosted.

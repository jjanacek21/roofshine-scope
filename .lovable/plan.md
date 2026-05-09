## Change

On the public rep card page (`/c/:slug`), make every "website" link/button point to `https://globalcontractor.network/schedule-consultation` instead of the company's stored website URL.

## Files to edit

**`src/routes/c.$slug.tsx`**
- Replace the company website footer link's `href` with the constant URL.
- Update the displayed text to something like "Schedule a Consultation" (since showing `globalcontractor.network/schedule-consultation` next to the company name would be confusing).
- Update `buildVCard()` so the vCard `URL:` field also uses the consultation link (so when someone saves the contact, tapping "website" in their phone opens the scheduler).
- Leave the company name/logo display untouched — only the outbound link target changes.

No backend or database changes. The `companies.website` column stays as-is; we just stop using it for the public card link.

## Open question

Should this also apply to the in-app rep card editor preview (`/card`), or only the public-facing `/c/:slug` page that QR codes point to? Default assumption: only the public page, since that's what QR codes hit.

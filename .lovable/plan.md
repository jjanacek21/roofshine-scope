I found the import request is reaching the server function with all 1,264 mapped leads, but it is being rejected before import with:

```text
401 Unauthorized: No authorization header provided
```

So the CSV itself is being parsed correctly. The problem is that the Lead import screen calls the authenticated server function without passing the current login token, so the backend refuses the request and returns “No leads imported.”

Plan to fix it:

1. Update the Lead Management Center import action
   - Before calling `importLeads`, read the current authenticated session from the app auth client.
   - Pass `Authorization: Bearer <access_token>` in the server function call.
   - If there is no valid session, show a clear toast like “Please sign in again before importing leads.”

2. Improve the import result handling
   - Stop clearing the selected CSV when the backend imports 0 rows, so the user can retry without re-uploading.
   - Show the actual first backend error in the toast instead of only “No leads imported.”
   - Keep clearing the file only after at least one lead imports successfully.

3. Add batching for reliability
   - Send the 1,264 leads in smaller batches instead of one huge server-function request.
   - Accumulate inserted counts and errors across batches.
   - This reduces timeout/payload risk and makes it easier to report partial success.

4. Optional but recommended backend cleanup
   - Avoid geocoding every import synchronously when a large CSV is imported; limit or skip geocoding during import so rows save quickly.
   - Keep contact/phone/email import logic intact.

Files I expect to change:

```text
src/routes/_app.leads.import.tsx
```

Likely no database migration is needed because the current schema and RLS policies already allow company admins to insert leads once the request includes the user’s auth token.
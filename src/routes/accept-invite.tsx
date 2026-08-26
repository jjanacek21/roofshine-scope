import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Alias for /cb/accept.
 *
 * Invite emails have gone out with both spellings. This used to be a second,
 * hand-maintained copy of the accept page, and the two drifted in exactly the
 * way that matters: /cb/accept stayed reachable on gcn.claims and this path did
 * not, so the standalone gate redirected it to /cb, dropped the token, and a
 * signed-out invitee landed in the paid signup funnel. There is one accept page
 * now; this path forwards to it with the token intact so every invite already
 * sent still works.
 */
export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/cb/accept", search: { token: search.token }, replace: true });
  },
});

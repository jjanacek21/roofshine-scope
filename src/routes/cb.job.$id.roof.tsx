import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old list-style roof checklist lived here. The sectioned takeoff sheet at
 * /cb/job/$id/takeoff is now the only roof takeoff, so this path just forwards.
 */
export const Route = createFileRoute("/cb/job/$id/roof")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/cb/job/$id/takeoff", params: { id: params.id } });
  },
});

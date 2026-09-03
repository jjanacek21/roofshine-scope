import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Company Training moved off Claim Buddy and onto the Global Contractor app.
 * Old /cb/training* links keep working.
 */
export const Route = createFileRoute("/cb/training/$")({
  beforeLoad: ({ params }) => {
    const rest = (params as { _splat?: string })._splat ?? "";
    throw redirect({ href: rest ? `/training/${rest}` : "/training", replace: true });
  },
  component: () => null,
});

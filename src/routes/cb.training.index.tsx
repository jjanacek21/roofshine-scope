import { createFileRoute, redirect } from "@tanstack/react-router";

/** Company Training now lives on the Global Contractor app at /training. */
export const Route = createFileRoute("/cb/training/")({
  beforeLoad: () => {
    throw redirect({ to: "/training", replace: true });
  },
  component: () => null,
});

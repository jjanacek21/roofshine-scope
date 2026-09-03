import { createFileRoute, redirect } from "@tanstack/react-router";

/** Course management now lives on the Global Contractor app at /training/manage. */
export const Route = createFileRoute("/cb/admin/training")({
  beforeLoad: () => {
    throw redirect({ to: "/training/manage", replace: true });
  },
  component: () => null,
});

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cb/admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/cb/admin/branding" });
  },
  component: () => null,
});

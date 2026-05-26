import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/door-to-door/")({
  beforeLoad: () => {
    throw redirect({ to: "/door-to-door/dispositions" });
  },
});

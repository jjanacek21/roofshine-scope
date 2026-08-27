import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — the module now lives at /commercial. */
export const Route = createFileRoute("/_app/roofking/")({
  beforeLoad: () => {
    throw redirect({ to: "/commercial" });
  },
});

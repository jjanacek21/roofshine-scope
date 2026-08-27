import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URLs — /roofking/<anything> now lives at /commercial/<anything>. */
export const Route = createFileRoute("/_app/roofking/$")({
  beforeLoad: ({ params }) => {
    const rest = (params as { _splat?: string })._splat ?? "";
    throw redirect({ to: rest ? `/commercial/${rest}` : "/commercial" });
  },
});

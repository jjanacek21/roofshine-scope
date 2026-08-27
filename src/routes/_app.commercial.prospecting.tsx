import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Prospecting is the full SPF prospecting app at /leads — dashboard, map,
 * list, pipeline, follow-up and training. It is reached from the Commercial
 * Roofing subnav; this route only exists so the /commercial/prospecting URL
 * keeps working.
 */
export const Route = createFileRoute("/_app/commercial/prospecting")({
  beforeLoad: () => {
    throw redirect({ to: "/leads" });
  },
});

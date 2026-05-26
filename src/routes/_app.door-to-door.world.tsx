import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import DoorToDoor from "@/pages/DoorToDoor";

const searchSchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  propertyId: z.string().optional(),
});

export const Route = createFileRoute("/_app/door-to-door/world")({
  validateSearch: (search) => searchSchema.parse(search),
  component: WorldRoute,
});

function WorldRoute() {
  const search = Route.useSearch();
  return <DoorToDoor focusLat={search.lat} focusLng={search.lng} focusPropertyId={search.propertyId} />;
}

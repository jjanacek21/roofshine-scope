import { createFileRoute } from "@tanstack/react-router";
import DoorToDoor from "@/pages/DoorToDoor";

export const Route = createFileRoute("/_app/door-to-door")({
  component: DoorToDoor,
});

import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/admin/ComingSoon";
export const Route = createFileRoute("/_app/leads/wizard")({
  component: () => <ComingSoon title="AI Roof Wizard" description="Drop pins on a roof, get Google Solar measurements, and run Claude vision analysis. Coming next." />,
});

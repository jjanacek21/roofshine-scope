import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/admin/ComingSoon";
export const Route = createFileRoute("/_app/leads/training")({
  component: () => <ComingSoon title="Training Center" description="Roof Kings cold call playbook with category sections. Coming next." />,
});

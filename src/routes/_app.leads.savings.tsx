import { createFileRoute } from "@tanstack/react-router";
import { LineChart } from "lucide-react";
import { ComingSoon } from "@/components/admin/ComingSoon";
export const Route = createFileRoute("/_app/leads/savings")({
  component: () => <ComingSoon title="Savings Report" description="20-year SPF restoration savings calculator. Coming next." icon={LineChart} />,
});

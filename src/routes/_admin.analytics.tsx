import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const Route = createFileRoute("/_admin/analytics")({
  component: () => <ComingSoon title="Analytics" description="Platform-wide usage and revenue dashboards." icon={BarChart3} />,
});

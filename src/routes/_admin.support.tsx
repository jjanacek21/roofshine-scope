import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const Route = createFileRoute("/_admin/support")({
  component: () => <ComingSoon title="Support" description="Help desk and 24/7 AI customer support." icon={LifeBuoy} />,
});

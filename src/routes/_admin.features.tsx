import { createFileRoute } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const Route = createFileRoute("/_admin/features")({
  component: () => <ComingSoon title="Feature Flags" description="Roll out features by company or user." icon={Flag} />,
});

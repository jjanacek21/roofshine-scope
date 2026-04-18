import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const Route = createFileRoute("/admin/reviews")({
  component: () => <ComingSoon title="Reviews" description="Approve or reject user submitted reviews." icon={Star} />,
});

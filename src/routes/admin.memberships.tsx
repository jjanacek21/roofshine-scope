import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const Route = createFileRoute("/admin/memberships")({
  component: () => <ComingSoon title="Plans & Pricing" description="Configure tiers, limits, and Stripe products." icon={CreditCard} />,
});

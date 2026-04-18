import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const Route = createFileRoute("/admin/emails")({
  component: () => <ComingSoon title="Email Blasts" description="Send to one user, a segment, or everyone." icon={Mail} />,
});

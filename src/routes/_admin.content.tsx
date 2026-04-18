import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const Route = createFileRoute("/_admin/content")({
  component: () => <ComingSoon title="Home Page CMS" description="Edit hero, features, and marketing copy." icon={FileText} />,
});

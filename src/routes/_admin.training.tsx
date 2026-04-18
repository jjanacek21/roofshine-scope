import { createFileRoute } from "@tanstack/react-router";
import { Video } from "lucide-react";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const Route = createFileRoute("/_admin/training")({
  component: () => <ComingSoon title="Training Videos" description="Upload and organize tutorials." icon={Video} />,
});

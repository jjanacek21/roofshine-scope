import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

export const Route = createFileRoute("/app/customers")({
  head: () => ({ meta: [{ title: "Customers · RoofScope Pro" }] }),
  component: () => (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your customer database.</p>
      <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Coming in Phase 2</h3>
        <p className="mt-1 text-sm text-muted-foreground">Customer management is on the roadmap.</p>
      </div>
    </div>
  ),
});

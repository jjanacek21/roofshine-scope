import type { LucideIcon } from "lucide-react";

export function ComingSoon({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-center">
        <Icon className="mb-4 h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Coming soon</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The data model and UI for this section are scheduled for a follow-up build. The route is reserved.
        </p>
      </div>
    </div>
  );
}

import { Search, Plus } from "lucide-react";
import { toast } from "sonner";

export function Topbar() {
  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b px-6 backdrop-blur-md"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "rgba(10, 10, 11, 0.7)",
      }}
    >
      <div className="relative max-w-md flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search jobs, clients, line items…"
          className="h-9 w-full rounded-md border bg-[var(--surface)] pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      <button
        onClick={() => toast.info("New Job wizard — coming in the next build")}
        className="btn-brand flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
      >
        <Plus className="h-4 w-4" />
        New Job
      </button>
    </header>
  );
}

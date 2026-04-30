import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/assemblies/import")({
  component: AssemblyImportPage,
});

function AssemblyImportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/macros"
          className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-[var(--surface-hover)]"
          style={{ borderColor: "var(--border)" }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Assemblies
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Import Assemblies from PDF</h1>
          <p className="text-sm text-muted-foreground">
            Upload a color-highlighted Xactimate PDF to create assemblies from each color group.
          </p>
        </div>
      </div>

      <div
        className="rounded-lg border p-8 text-center"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <p className="text-sm text-muted-foreground">
          PDF import review UI coming next. The backend endpoint{" "}
          <code className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs">
            /api/import-assembly-pdf
          </code>{" "}
          is ready to receive uploads.
        </p>
      </div>
    </div>
  );
}

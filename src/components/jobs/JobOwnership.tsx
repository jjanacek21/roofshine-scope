import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyMembers, memberName } from "@/hooks/useCompanyMembers";
import { useIsCompanyAdmin } from "@/hooks/useProfile";
import { toast } from "sonner";

type Props = {
  jobId: string;
  createdBy: string | null;
  assignedTo: string | null;
};

export function JobOwnership({ jobId, createdBy, assignedTo }: Props) {
  const qc = useQueryClient();
  const isAdmin = useIsCompanyAdmin();
  const { data: members = [] } = useCompanyMembers();
  const map = new Map(members.map((m) => [m.id, m]));

  const reassign = useMutation({
    mutationFn: async (newId: string) => {
      const { error } = await supabase.from("jobs").update({ assigned_to: newId }).eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job reassigned");
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-2 text-xs"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
      <span className="text-muted-foreground">
        Created by <span className="font-medium text-foreground">{memberName(map.get(createdBy ?? ""))}</span>
      </span>
      <span className="flex items-center gap-2 text-muted-foreground">
        Assigned to{" "}
        {isAdmin ? (
          <select
            value={assignedTo ?? ""}
            onChange={(e) => reassign.mutate(e.target.value)}
            className="rounded border bg-transparent px-2 py-1 text-xs text-foreground"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">—</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{memberName(m)}</option>
            ))}
          </select>
        ) : (
          <span className="font-medium text-foreground">{memberName(map.get(assignedTo ?? ""))}</span>
        )}
      </span>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlaybook, setMyPlaybook } from "@/lib/playbook-prefs.functions";
import { DEFAULT_PLAYBOOK_SELECTION } from "@/lib/playbook";
import { useAuth } from "@/hooks/useAuth";

export function useMyPlaybook() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getMyPlaybook);
  const setFn = useServerFn(setMyPlaybook);

  const q = useQuery({
    queryKey: ["my-playbook", user?.id ?? null],
    queryFn: () => fetchFn(),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const ids: string[] = q.data?.selected_sections ?? DEFAULT_PLAYBOOK_SELECTION;

  const m = useMutation({
    mutationFn: async (next: string[]) => {
      await setFn({ data: { selected_sections: next } });
      return next;
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["my-playbook", user?.id ?? null] });
      const prev = qc.getQueryData(["my-playbook", user?.id ?? null]);
      qc.setQueryData(["my-playbook", user?.id ?? null], { selected_sections: next });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["my-playbook", user?.id ?? null], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["my-playbook", user?.id ?? null] });
    },
  });

  function toggle(id: string) {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    m.mutate(next);
  }
  function set(next: string[]) {
    m.mutate(next);
  }

  return { ids, toggle, set, isLoading: q.isLoading };
}

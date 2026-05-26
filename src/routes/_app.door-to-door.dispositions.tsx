import { useMemo, useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MapPin, Briefcase, Search, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DISPOSITIONS } from "@/components/door-to-door/DispositionQuickBar";
import type { PropertyDisposition } from "@/hooks/usePropertyDispositions";
import { convertDispositionToJob } from "@/lib/d2d-convert.functions";

export const Route = createFileRoute("/_app/door-to-door/dispositions")({
  component: DispositionsPage,
});

type Row = {
  id: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  disposition: PropertyDisposition | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
  priority: string | null;
  tags: string[] | null;
  updated_at: string;
  created_at: string;
  converted_job_id: string | null;
};

function DispositionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const convertFn = useServerFn(convertDispositionToJob);

  const [search, setSearch] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["d2d-dispositions", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("property_dispositions")
        .select(
          "id, lat, lng, address, disposition, customer_name, customer_phone, customer_email, notes, priority, tags, updated_at, created_at, converted_job_id",
        )
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Realtime: refresh on changes so dropping a pin in /world updates here
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`d2d-dispositions-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "property_dispositions", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["d2d-dispositions", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (dispositionFilter !== "all" && r.disposition !== dispositionFilter) return false;
      if (priorityFilter !== "all" && (r.priority ?? "normal") !== priorityFilter) return false;
      if (hideEmpty && !r.customer_name && !r.customer_phone && !r.customer_email) return false;
      if (q) {
        const hay = [r.customer_name, r.address, r.customer_phone, r.customer_email, r.notes, (r.tags ?? []).join(" ")]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, dispositionFilter, priorityFilter, hideEmpty]);

  const convertMut = useMutation({
    mutationFn: (dispositionId: string) => convertFn({ data: { dispositionId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["d2d-dispositions"] });
      qc.invalidateQueries({ queryKey: ["sidebar-jobs-count"] });
      toast.success(res.alreadyConverted ? "Already converted" : "Job created", {
        description: "Open it in your Jobs board.",
        action: { label: "Open Job", onClick: () => navigate({ to: "/jobs/$id", params: { id: res.jobId } }) },
      });
      setConfirmId(null);
    },
    onError: (e: Error) => {
      toast.error("Could not convert", { description: e.message });
    },
  });

  const openOnMap = (r: Row) => {
    if (r.lat == null || r.lng == null) {
      toast.error("No coordinates on this disposition");
      return;
    }
    navigate({
      to: "/door-to-door/world",
      search: { lat: r.lat, lng: r.lng, propertyId: r.id },
    });
  };

  const dispMeta = (d: PropertyDisposition | null) => DISPOSITIONS.find((x) => x.value === d);

  return (
    <div className="space-y-4 pt-2">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dispositions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every pin you've dropped. Filter, jump back to the map, or convert into a job.
        </p>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, address, phone, email, notes…"
            className="pl-8"
          />
        </div>
        <Select value={dispositionFilter} onValueChange={setDispositionFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Disposition" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dispositions</SelectItem>
            {DISPOSITIONS.map((d) => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={hideEmpty ? "default" : "outline"}
          size="sm"
          onClick={() => setHideEmpty((v) => !v)}
        >
          Has contact info
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading dispositions…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {rows.length === 0
                ? "No dispositions yet — head into the World to drop your first pin."
                : "No dispositions match these filters."}
            </p>
            {rows.length === 0 && (
              <Button className="mt-4" onClick={() => navigate({ to: "/door-to-door/world" })}>
                Enter World
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Disposition</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const meta = dispMeta(r.disposition);
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => openOnMap(r)}>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: meta ? `${meta.hexColor}22` : undefined,
                          color: meta?.hexColor,
                          borderColor: meta ? `${meta.hexColor}55` : undefined,
                        }}
                        variant="outline"
                      >
                        {meta?.label ?? r.disposition ?? "—"}
                      </Badge>
                      {r.converted_job_id && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--brand)]">Converted</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-foreground">{r.customer_name || "—"}</div>
                      <div className="font-mono-num text-xs text-muted-foreground">
                        {r.customer_phone || ""}{r.customer_phone && r.customer_email ? " · " : ""}{r.customer_email || ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {r.address || (
                        <span className="font-mono-num text-xs text-muted-foreground">
                          {r.lat?.toFixed(5)}, {r.lng?.toFixed(5)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(r.tags ?? []).slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => openOnMap(r)}>
                          <MapPin className="mr-1 h-3 w-3" /> Map
                        </Button>
                        {r.converted_job_id ? (
                          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/jobs/$id", params: { id: r.converted_job_id! } })}>
                            <ExternalLink className="mr-1 h-3 w-3" /> Job
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => setConfirmId(r.id)} disabled={convertMut.isPending}>
                            <Briefcase className="mr-1 h-3 w-3" /> Convert
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert disposition to job?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates a new job on your Jobs board and copies the contact info, address,
              notes, and photos from this disposition. You can still edit everything afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={convertMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={convertMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmId) convertMut.mutate(confirmId);
              }}
            >
              {convertMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : "Create Job"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

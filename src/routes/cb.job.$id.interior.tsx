import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading, CbEmptyState } from "@/components/cb/primitives";
import { CbField, CbTextarea } from "@/components/cb/forms";
import { CbCamera } from "@/components/cb/CbCamera";
import { CbPendingPill } from "@/components/claim-buddy/CbJobStepShell";
import { CbUnifiedChecklist } from "@/components/claim-buddy/CbUnifiedChecklist";
import { CbPicker } from "@/components/claim-buddy/CbTakeoffFields";
import { useCbCatalog } from "@/lib/cbCatalog";
import { buildInteriorRows, type CbRow } from "@/lib/cbSheetRows";
import { readSheet, CB_FLOORING_TYPES, type CbInteriorArea, type CbSheet } from "@/lib/cbSheet";
import { useCbTakeoff, type CbRoom, type CbTakeoff } from "@/lib/cbTakeoff";

export const Route = createFileRoute("/cb/job/$id/interior")({
  head: () => ({
    meta: [
      { title: "Interior walk — Claim Buddy" },
      {
        name: "description",
        content: "Room-by-room interior documentation — one sheet per room with photos, quantities and readings.",
      },
      { property: "og:title", content: "Interior walk — Claim Buddy" },
      { property: "og:description", content: "Only walked when there's water inside." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbInteriorWalk,
});

function CbInteriorWalk() {
  const { id } = useParams({ from: "/cb/job/$id/interior" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { takeoff, isLoading, patchData, mutate } = useCbTakeoff(id);
  const { data: catalog, isLoading: catalogLoading } = useCbCatalog("interior");
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [cam, setCam] = useState<CbRoom | null>(null);

  const { data: takeoffPhotos } = useQuery({
    queryKey: ["cb-int-takeoff-photos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cb_photos")
        .select("item_key")
        .eq("job_id", id)
        .eq("category", "takeoff");
      return data ?? [];
    },
  });

  const photoCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of takeoffPhotos ?? []) {
      const k = (p as { item_key: string | null }).item_key ?? "";
      if (k) map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [takeoffPhotos]);

  const sheet = useMemo(() => readSheet(takeoff.data as Record<string, unknown>), [takeoff.data]);

  const { data: job } = useQuery({
    queryKey: ["cb-job-ws", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cb_jobs")
        .select("id, workspace_id")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const rooms = takeoff.data.rooms ?? [];

  const writeRooms = (next: CbRoom[]) => patchData({ rooms: next });
  const patchRoom = (roomId: string, patch: Partial<CbRoom>) =>
    writeRooms(rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)));

  const patchRoomArea = (roomId: string, part: Partial<CbInteriorArea>) =>
    patchData({
      sheet: {
        ...sheet,
        interior: {
          ...(sheet.interior ?? {}),
          [roomId]: { ...((sheet.interior ?? {})[roomId] ?? {}), ...part },
        },
      },
    });

  /** One atomic write per row: room checklist item + room takeoff field. */
  function writeRow(
    roomId: string,
    row: CbRow,
    patch: { selected?: boolean; qty?: number | null; note?: string; shot?: "medium" | "close"; count?: number },
  ) {
    void mutate((prev): Omit<CbTakeoff, "job_id"> => {
      const prevSheet = readSheet(prev.data as Record<string, unknown>) as CbSheet;
      const prevRooms = (prev.data.rooms ?? []) as CbRoom[];
      const prevArea = { ...((prevSheet.interior ?? {})[roomId] ?? {}) } as Record<string, unknown>;

      const nextRooms = prevRooms.map((r) => {
        if (r.id !== roomId || !row.catalogKey) return r;
        const items = { ...(r.items ?? {}) };
        if (patch.selected === false) {
          delete items[row.catalogKey];
        } else {
          const next = { ...(items[row.catalogKey] ?? {}) };
          if (patch.qty !== undefined) next.qty = patch.qty;
          if (patch.note !== undefined) next.note = patch.note;
          if (patch.shot && patch.count) {
            next[patch.shot] = ((next[patch.shot] ?? 0) as number) + patch.count;
          }
          items[row.catalogKey] = next;
        }
        return { ...r, items };
      });

      if (row.fieldKey) {
        if (patch.selected === false) delete prevArea[row.fieldKey];
        if (patch.qty !== undefined) prevArea[row.fieldKey] = patch.qty ?? undefined;
      }

      return {
        data: {
          ...prev.data,
          rooms: nextRooms,
          sheet: {
            ...prevSheet,
            interior: { ...(prevSheet.interior ?? {}), [roomId]: prevArea as CbInteriorArea },
          },
        },
        elevations: prev.elevations,
      };
    });
  }

  function addRoom() {
    const room: CbRoom = { id: crypto.randomUUID(), name: `Room ${rooms.length + 1}` };
    void writeRooms([...rooms, room]);
    setOpenRoom(room.id);
  }

  if (isLoading) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[620px]">
            <CbLoading label="Loading the interior walk…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  return (
    <CbSurface>
      <div className="min-h-screen px-4 pb-28 pt-6" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[620px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="cb-display" style={{ fontSize: 24, margin: 0 }}>
                Interior
              </h1>
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                Room by room — one sheet each: check it, size it, shoot it.
              </p>
            </div>
            <CbButton size="md" variant="ghost" onClick={() => navigate({ to: "/cb" })}>
              Save &amp; exit
            </CbButton>
          </div>

          {rooms.length === 0 ? (
            <div className="mt-5">
              <CbEmptyState
                headline="No rooms yet"
                body="Add the first room with water damage and we'll walk the rest with you."
                action={
                  <CbButton onClick={addRoom}>
                    <Plus size={16} className="mr-2 inline" /> Add a room
                  </CbButton>
                }
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {rooms.map((room) => {
                const open = openRoom === room.id;
                const itemCount = Object.keys(room.items ?? {}).length;
                const area: CbInteriorArea = (sheet.interior ?? {})[room.id] ?? {};
                return (
                  <CbCard key={room.id} elevation={open ? "floating" : "card"} style={{ padding: 18 }}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-left"
                      onClick={() => setOpenRoom(open ? null : room.id)}
                      aria-expanded={open}
                    >
                      <span className="text-[16.5px] font-semibold" style={{ color: "var(--cb-text)" }}>
                        {room.name}
                      </span>
                      <span className="flex items-center gap-2">
                        {room.photos ? <CbBadge tone="accent">{room.photos} photos</CbBadge> : null}
                        {itemCount ? <CbBadge tone="neutral">{itemCount} items</CbBadge> : null}
                      </span>
                    </button>

                    {open ? (
                      <div className="mt-4 grid gap-3">
                        <div className="grid gap-3" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
                          <CbField
                            label="Room name"
                            value={room.name}
                            onChange={(e) => void patchRoom(room.id, { name: e.target.value })}
                          />
                          <CbField
                            label="Moisture %"
                            inputMode="decimal"
                            value={room.moisture ?? ""}
                            onChange={(e) =>
                              void patchRoom(room.id, {
                                moisture: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                        </div>

                        <CbButton block variant="secondary" onClick={() => setCam(room)}>
                          <Camera size={16} className="mr-2 inline" /> Shoot this room
                        </CbButton>

                        <CbCard elevation="card" style={{ padding: 16 }}>
                          <CbPicker
                            label="Flooring"
                            options={CB_FLOORING_TYPES}
                            value={area.flooring_type}
                            onChange={(v) => void patchRoomArea(room.id, { flooring_type: v })}
                          />
                        </CbCard>

                        <CbUnifiedChecklist
                          groups={buildInteriorRows({
                            catalog,
                            entries: room.items ?? {},
                            area,
                            photoCounts,
                            roomId: room.id,
                          })}
                          isLoading={catalogLoading}
                          jobId={id}
                          workspaceId={job?.workspace_id as string | undefined}
                          contextLabel={room.name}
                          contextKey={room.id}
                          onToggle={(row, next) => writeRow(room.id, row, { selected: next })}
                          onQty={(row, value) => writeRow(room.id, row, { qty: value, selected: true })}
                          onNote={(row, value) => writeRow(room.id, row, { note: value })}
                          onShot={(row, kind, count) => {
                            if (kind === "detail") {
                              void qc.invalidateQueries({ queryKey: ["cb-int-takeoff-photos", id] });
                              return;
                            }
                            writeRow(room.id, row, { selected: true, shot: kind, count });
                          }}
                        />

                        <CbCard elevation="card" style={{ padding: 16 }}>
                          <CbTextarea
                            label="Contents note"
                            rows={3}
                            value={area.contents_note ?? ""}
                            onChange={(e) => void patchRoomArea(room.id, { contents_note: e.target.value })}
                          />
                        </CbCard>

                        <CbButton
                          block
                          variant="danger"
                          onClick={() => {
                            setOpenRoom(null);
                            void writeRooms(rooms.filter((r) => r.id !== room.id));
                          }}
                        >
                          <Trash2 size={16} className="mr-2 inline" /> Remove room
                        </CbButton>
                      </div>
                    ) : null}
                  </CbCard>
                );
              })}

              <CbButton block variant="secondary" onClick={addRoom}>
                <Plus size={16} className="mr-2 inline" /> Add another room
              </CbButton>
              <CbButton block onClick={() => navigate({ to: "/cb/job/$id/scope", params: { id } })}>
                Finish interior inspection
              </CbButton>
            </div>
          )}
        </div>

        {cam ? (
          <CbCamera
            open
            jobId={id}
            workspaceId={job?.workspace_id as string | undefined}
            title={`${cam.name} — photos`}
            instruction="Wide of the room first, then tight on each affected area."
            captionContext={`${cam.name} — interior`}
            meta={{ category: "interior", elevation: cam.id, shot_type: "room" }}
            onSaved={(count) => void patchRoom(cam.id, { photos: (cam.photos ?? 0) + count })}
            onClose={() => setCam(null)}
          />
        ) : null}

        <CbPendingPill />
      </div>
    </CbSurface>
  );
}

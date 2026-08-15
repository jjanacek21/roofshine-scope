import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading, CbEmptyState } from "@/components/cb/primitives";
import { CbField } from "@/components/cb/forms";
import { CbCamera } from "@/components/cb/CbCamera";
import { CbPendingPill } from "@/components/claim-buddy/CbJobStepShell";
import { CbDamageChecklist } from "@/components/claim-buddy/CbDamageChecklist";
import { CbInteriorTakeoffFields } from "@/components/claim-buddy/CbTakeoffFields";
import { readSheet, type CbInteriorArea } from "@/lib/cbSheet";
import { useCbTakeoff, type CbRoom, type CbItemEntry } from "@/lib/cbTakeoff";


export const Route = createFileRoute("/cb/job/$id/interior")({
  head: () => ({
    meta: [
      { title: "Interior walk — Claim Buddy" },
      {
        name: "description",
        content: "Room-by-room interior documentation with checklist items, photos and moisture readings.",
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
  const { takeoff, isLoading, patchData } = useCbTakeoff(id);
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [cam, setCam] = useState<CbRoom | null>(null);
  const [takeoffCam, setTakeoffCam] = useState<{ itemKey: string; label: string } | null>(null);

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
  const patchRoomItem = (room: CbRoom, itemKey: string, patch: Partial<CbItemEntry> | null) => {
    const items = { ...(room.items ?? {}) };
    if (patch === null) delete items[itemKey];
    else items[itemKey] = { ...(items[itemKey] ?? {}), ...patch };
    return patchRoom(room.id, { items });
  };

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
                Room by room — name it, log what&apos;s wet, shoot it, take a reading.
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

                        <CbDamageChecklist
                          scope="interior"
                          jobId={id}
                          workspaceId={job?.workspace_id as string | undefined}
                          elevationKey={room.id}
                          elevationLabel={room.name}
                          entries={room.items ?? {}}
                          photoCategory="interior"
                          onShot={(itemKey, kind, count) =>
                            void patchRoomItem(room, itemKey, {
                              [kind]: ((room.items?.[itemKey]?.[kind] ?? 0) as number) + count,
                            })
                          }
                          onEntry={(itemKey, patch) => void patchRoomItem(room, itemKey, patch)}
                          onRemove={(itemKey) => void patchRoomItem(room, itemKey, null)}
                        />

                        <CbInteriorTakeoffFields
                          roomId={room.id}
                          roomName={room.name}
                          area={(sheet.interior ?? {})[room.id] ?? {}}
                          onPatch={(part) => void patchRoomArea(room.id, part)}
                          onCamera={(itemKey, itemLabel) =>
                            setTakeoffCam({ itemKey, label: itemLabel })
                          }
                          photoCounts={photoCounts}
                        />


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

        {takeoffCam ? (
          <CbCamera
            open
            jobId={id}
            workspaceId={job?.workspace_id as string | undefined}
            title={takeoffCam.label}
            instruction={`Photograph the ${takeoffCam.label.toLowerCase()} so the line item and the photo stay linked.`}
            captionContext={`Interior takeoff — ${takeoffCam.label}`}
            meta={{ category: "takeoff", item_key: takeoffCam.itemKey, shot_type: "detail" }}
            onSaved={() => setTakeoffCam(null)}
            onClose={() => setTakeoffCam(null)}
          />
        ) : null}



        <CbPendingPill />
      </div>
    </CbSurface>
  );
}

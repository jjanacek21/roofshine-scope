import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbLoading } from "@/components/cb/primitives";
import { CbJobStepShell } from "@/components/claim-buddy/CbJobStepShell";
import { cbEnqueuePhoto } from "@/lib/cbPhotoQueue";

export const Route = createFileRoute("/cb/job/$id/cover")({
  head: () => ({
    meta: [
      { title: "Cover photo — Claim Buddy" },
      {
        name: "description",
        content: "Shoot the front of the house straight on to open the Claim Buddy inspection.",
      },
      { property: "og:title", content: "Cover photo — Claim Buddy" },
      { property: "og:description", content: "Step two of the Claim Buddy inspection flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbJobCoverPage,
});

const TIP_KEY = "cb_cover_tip_dismissed";

function CbJobCoverPage() {
  const { id } = useParams({ from: "/cb/job/$id/cover" });
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [tipOpen, setTipOpen] = useState(true);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ["cb-job-ws", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_jobs")
        .select("id, workspace_id, address")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    try {
      if (sessionStorage.getItem(TIP_KEY) === "1") setTipOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  // Open the camera only once the tip card is out of the way.
  useEffect(() => {
    if (tipOpen || shot) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCamError("Camera unavailable — use the picker below.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [tipOpen, shot]);

  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob((b) => {
      if (!b) return;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setShot({ blob: b, url: URL.createObjectURL(b) });
    }, "image/jpeg", 0.92);
  }

  async function useThisPhoto() {
    if (!shot || !job?.workspace_id) return;
    setBusy(true);
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 }),
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      /* location is optional */
    }
    await cbEnqueuePhoto({
      jobId: id,
      workspaceId: job.workspace_id as string,
      blob: shot.blob,
      meta: { category: "cover", filename: "cover.jpg", shot_type: "overview", lat, lng },
    });
    setBusy(false);
    toast.success("Cover photo queued — it uploads in the background.");
    navigate({ to: "/cb/job/$id/scope", params: { id } });
  }

  if (isLoading) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[620px]">
            <CbLoading label="Warming up the camera…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  return (
    <CbSurface>
      <CbJobStepShell
        step={1}
        jobId={id}
        title="Cover photo"
        subtitle="Front of the house, straight on."
      >
        {tipOpen ? (
          <CbCard elevation="floating" style={{ padding: 22 }}>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--cb-text)" }}>
              Before you shoot — grab your chalk and tape measure. Every close-up needs the chalked
              test square in frame, and anything satellite can&apos;t measure needs the tape in frame
              with the number readable.
            </p>
            <div className="mt-5">
              <CbButton
                block
                onClick={() => {
                  try {
                    sessionStorage.setItem(TIP_KEY, "1");
                  } catch {
                    /* ignore */
                  }
                  setTipOpen(false);
                }}
              >
                Got it — open the camera
              </CbButton>
            </div>
          </CbCard>
        ) : (
          <CbCard elevation="floating" style={{ padding: 14 }}>
            <div className="cb-camera-frame">
              {shot ? (
                <img src={shot.url} alt="Cover photo preview" className="cb-camera-media" />
              ) : (
                <video ref={videoRef} playsInline muted className="cb-camera-media" />
              )}
            </div>

            {camError ? (
              <p className="mt-3 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                {camError}
              </p>
            ) : null}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setShot({ blob: f, url: URL.createObjectURL(f) });
              }}
            />

            <div className="mt-4 grid gap-2">
              {shot ? (
                <>
                  <CbButton block loading={busy} loadingText="Queuing…" onClick={useThisPhoto}>
                    Use this photo
                  </CbButton>
                  <CbButton
                    block
                    variant="secondary"
                    onClick={() => {
                      URL.revokeObjectURL(shot.url);
                      setShot(null);
                    }}
                  >
                    Retake
                  </CbButton>
                </>
              ) : (
                <>
                  <CbButton block onClick={capture} disabled={!!camError}>
                    Shoot the front
                  </CbButton>
                  <CbButton block variant="secondary" onClick={() => fileRef.current?.click()}>
                    Choose from library
                  </CbButton>
                </>
              )}
              <CbButton
                block
                variant="ghost"
                onClick={() => navigate({ to: "/cb/job/$id/scope", params: { id } })}
              >
                Skip for now
              </CbButton>
            </div>
          </CbCard>
        )}
      </CbJobStepShell>
    </CbSurface>
  );
}

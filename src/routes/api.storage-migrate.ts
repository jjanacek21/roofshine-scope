import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

type Entry = { path: string; size: number | null; mimetype: string | null };

async function listAll(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
  acc: Entry[],
  cap: number,
): Promise<void> {
  let page = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset: page * pageSize,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data) return;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      const isFolder = !(item as any).id && !(item as any).metadata;
      if (isFolder) {
        await listAll(client, bucket, full, acc, cap);
      } else {
        acc.push({
          path: full,
          size: ((item as any).metadata?.size as number) ?? null,
          mimetype: ((item as any).metadata?.mimetype as string) ?? null,
        });
      }
      if (acc.length >= cap) return;
    }
    if (data.length < pageSize) return;
    page++;
  }
}

export const Route = createFileRoute("/api/storage-migrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const NEW_KEY = process.env.GCN_NEW_SERVICE_KEY;
        const NEW_URL = process.env.GCN_NEW_SUPABASE_URL;
        const SRC_URL = process.env.SUPABASE_URL;
        const SRC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!NEW_KEY || !timingSafeEqualStr(provided, NEW_KEY)) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!NEW_URL || !SRC_URL || !SRC_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }

        const src = createClient(SRC_URL, SRC_KEY, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const dst = createClient(NEW_URL, NEW_KEY, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        if (body.action === "buckets") {
          const { data: buckets, error } = await src.storage.listBuckets();
          if (error || !buckets) {
            return Response.json({ error: error?.message ?? "list failed" }, { status: 500 });
          }
          const { data: dstBuckets } = await dst.storage.listBuckets();
          const existing = new Set((dstBuckets ?? []).map((b) => b.id));
          const out: any[] = [];
          for (const b of buckets) {
            let created = false;
            let createError: string | null = null;
            if (!existing.has(b.id)) {
              const { error: cErr } = await dst.storage.createBucket(b.id, {
                public: (b as any).public,
                fileSizeLimit: (b as any).file_size_limit ?? undefined,
                allowedMimeTypes: (b as any).allowed_mime_types ?? undefined,
              });
              if (cErr) createError = cErr.message;
              else created = true;
            }
            const acc: Entry[] = [];
            await listAll(src, b.id, "", acc, 100000);
            out.push({
              id: b.id,
              public: (b as any).public,
              objects: acc.length,
              created,
              ...(createError ? { createError } : {}),
            });
          }
          return Response.json({ buckets: out });
        }

        if (body.action === "copy") {
          const bucket = String(body.bucket ?? "");
          if (!bucket) return Response.json({ error: "bucket required" }, { status: 400 });
          const offset = Math.max(0, parseInt(String(body.offset ?? 0), 10) || 0);
          const rawLimit = parseInt(String(body.limit ?? 20), 10) || 20;
          const limit = Math.min(50, Math.max(1, rawLimit));

          const acc: Entry[] = [];
          await listAll(src, bucket, "", acc, offset + limit);
          const slice = acc.slice(offset, offset + limit);

          let copied = 0;
          let skipped = 0;
          let failed = 0;
          const errors: { path: string; message: string }[] = [];

          for (const obj of slice) {
            try {
              const dir = obj.path.includes("/") ? obj.path.slice(0, obj.path.lastIndexOf("/")) : "";
              const name = obj.path.slice(obj.path.lastIndexOf("/") + 1);
              const { data: dstList } = await dst.storage.from(bucket).list(dir, {
                limit: 1,
                search: name,
              });
              const match = (dstList ?? []).find((d) => d.name === name);
              if (match && obj.size != null && (match as any).metadata?.size === obj.size) {
                skipped++;
                continue;
              }

              const { data: blob, error: dErr } = await src.storage.from(bucket).download(obj.path);
              if (dErr || !blob) throw new Error(dErr?.message ?? "download failed");

              const { error: uErr } = await dst.storage.from(bucket).upload(obj.path, blob, {
                upsert: true,
                contentType: obj.mimetype ?? (blob as Blob).type ?? "application/octet-stream",
              });
              if (uErr) throw new Error(uErr.message);
              copied++;
            } catch (e) {
              failed++;
              errors.push({ path: obj.path, message: (e as Error).message });
            }
          }

          return Response.json({
            bucket,
            offset,
            attempted: slice.length,
            copied,
            skipped,
            failed,
            errors,
            done: slice.length < limit,
          });
        }

        return Response.json({ error: "Unknown action" }, { status: 400 });
      },
    },
  },
});

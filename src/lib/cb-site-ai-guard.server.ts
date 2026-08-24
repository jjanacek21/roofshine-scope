/**
 * Server-only whitelist + apply engine for the marketing AI editor.
 * Every hard limit lives here, in code — never in the prompt.
 */
import type { CbSiteAiChange } from "./cb-site-ai.functions";
import { ALLOWED_COLUMNS, CB_SITE_AI_TABLES, type CbSiteAiTable } from "./cb-site-ai.server";

type Rows = Record<string, Record<string, unknown>[]>;

const isTable = (t: unknown): t is CbSiteAiTable =>
  typeof t === "string" && (CB_SITE_AI_TABLES as readonly string[]).includes(t);

function getPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

function findRow(rows: Rows, table: CbSiteAiTable, rowKey: string) {
  const list = rows[table] ?? [];
  return list.find(
    (r) => String(r["key"] ?? "") === rowKey || String(r["id"] ?? "") === rowKey,
  );
}

/* ------------------------------------------------------------------ */
/* sanitize                                                            */
/* ------------------------------------------------------------------ */

export function sanitizeChanges(
  input: unknown[],
  rows: Rows,
): { changes: CbSiteAiChange[]; dropped: string[] } {
  const changes: CbSiteAiChange[] = [];
  const dropped: string[] = [];

  for (const rawItem of input) {
    const c = rawItem as Record<string, unknown>;
    const table = c?.["table"];
    const rowKey = String(c?.["row_key"] ?? "");
    const path = String(c?.["path"] ?? "");
    const next = c?.["new"];

    if (!isTable(table)) {
      dropped.push(`table "${String(table)}" is not editable`);
      continue;
    }
    if (typeof next !== "string" && typeof next !== "number" && typeof next !== "boolean") {
      dropped.push(`${table}.${path}: unsupported value type`);
      continue;
    }

    const isInsert = table === "cb_site_faq" && /^new/i.test(rowKey);
    if (!isInsert && !rowKey) {
      dropped.push(`${table}: missing row reference`);
      continue;
    }

    if (table === "cb_site_blocks") {
      if (!path.includes(".") && !path) {
        dropped.push("cb_site_blocks: a content path is required");
        continue;
      }
    } else {
      const col = path.split(".")[0];
      if (!ALLOWED_COLUMNS[table].includes(col)) {
        dropped.push(`${table}.${col || "(none)"} is not an editable field`);
        continue;
      }
    }

    const row = isInsert ? undefined : findRow(rows, table, rowKey);
    if (!isInsert && !row) {
      dropped.push(`${table}: row "${rowKey}" not found`);
      continue;
    }

    const current = isInsert
      ? ""
      : table === "cb_site_blocks"
        ? getPath(row?.["content"], path)
        : row?.[path];

    changes.push({
      table,
      row_key: rowKey,
      path,
      old: current === null || current === undefined ? "" : String(current),
      new: String(next),
      why: typeof c?.["why"] === "string" ? (c["why"] as string) : "",
      insert: isInsert,
      label:
        table === "cb_site_blocks"
          ? `${rowKey} · ${path}`
          : isInsert
            ? `new FAQ entry · ${path}`
            : `${String(row?.["title"] ?? row?.["question"] ?? rowKey)} · ${path}`,
    });
  }

  return { changes, dropped };
}

/* ------------------------------------------------------------------ */
/* apply                                                               */
/* ------------------------------------------------------------------ */

export async function applyChanges(
  raw: CbSiteAiChange[],
  rows: Rows,
  instruction: string,
  userId: string,
): Promise<{ applied: number; errors: string[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { changes } = sanitizeChanges(raw as unknown[], rows);
  const errors: string[] = [];
  let applied = 0;

  const log = async (
    table: string,
    rowKey: string,
    path: string,
    oldValue: string | null,
    newValue: string | null,
  ) => {
    await supabaseAdmin.from("cb_site_edits").insert({
      table_name: table,
      row_key: rowKey,
      path,
      old_value: oldValue,
      new_value: newValue,
      instruction,
      applied_by: userId,
    } as never);
  };

  // group FAQ inserts by their row_key so one entry becomes one row
  const inserts = new Map<string, Record<string, string>>();
  for (const c of changes) {
    if (c.insert) {
      const bag = inserts.get(c.row_key) ?? {};
      bag[c.path] = c.new;
      inserts.set(c.row_key, bag);
    }
  }

  for (const [key, bag] of inserts) {
    try {
      const payload: Record<string, unknown> = { is_published: true };
      for (const [col, val] of Object.entries(bag)) {
        if (ALLOWED_COLUMNS.cb_site_faq.includes(col)) payload[col] = val;
      }
      if (!payload["question"] || !payload["answer"]) {
        errors.push(`New FAQ "${key}" needs both a question and an answer.`);
        continue;
      }
      const { data, error } = await supabaseAdmin
        .from("cb_site_faq")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw error;
      applied++;
      await log("cb_site_faq", String((data as { id: string }).id), "(insert)", null, JSON.stringify(payload));
    } catch (e) {
      errors.push(`New FAQ "${key}": ${(e as Error).message}`);
    }
  }

  // all block edits for one row are merged into a single jsonb write, so two
  // changes to the same block can never clobber each other
  const blockGroups = new Map<string, CbSiteAiChange[]>();
  for (const c of changes) {
    if (c.insert || c.table !== "cb_site_blocks") continue;
    const row = findRow(rows, "cb_site_blocks", c.row_key);
    if (!row) continue;
    const key = String(row["key"]);
    blockGroups.set(key, [...(blockGroups.get(key) ?? []), c]);
  }

  for (const [key, group] of blockGroups) {
    try {
      const { data: fresh } = await supabaseAdmin
        .from("cb_site_blocks")
        .select("content")
        .eq("key", key)
        .maybeSingle();
      const content = JSON.parse(
        JSON.stringify((fresh as { content?: unknown } | null)?.content ?? {}),
      ) as Record<string, unknown>;
      const befores = group.map((c) => getPath(content, c.path));
      for (const c of group) setPath(content, c.path, c.new);
      const { error } = await supabaseAdmin
        .from("cb_site_blocks")
        .update({ content } as never)
        .eq("key", key);
      if (error) throw error;
      for (let i = 0; i < group.length; i++) {
        const before = befores[i];
        await log(
          "cb_site_blocks",
          key,
          group[i].path,
          before === undefined || before === null ? null : String(before),
          group[i].new,
        );
        applied++;
      }
    } catch (e) {
      errors.push(`cb_site_blocks/${key}: ${(e as Error).message}`);
    }
  }

  for (const c of changes) {
    if (c.insert || c.table === "cb_site_blocks") continue;
    try {
      {
        const table = c.table as CbSiteAiTable;
        const col = c.path;
        if (!ALLOWED_COLUMNS[table].includes(col)) continue;
        const row = findRow(rows, table, c.row_key)!;
        const before = row[col];
        const value = col === "sort_order" ? Number(c.new) : c.new;
        const { error } = await supabaseAdmin
          .from(table)
          .update({ [col]: value } as never)
          .eq("id", String(row["id"]));
        if (error) throw error;
        await log(
          table,
          String(row["id"]),
          col,
          before === undefined || before === null ? null : String(before),
          c.new,
        );
      }
      applied++;
    } catch (e) {
      errors.push(`${c.table}.${c.path}: ${(e as Error).message}`);
    }
  }

  return { applied, errors };
}

/* ------------------------------------------------------------------ */
/* revert                                                              */
/* ------------------------------------------------------------------ */

export async function revertEdit(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: edit, error } = await supabaseAdmin
    .from("cb_site_edits")
    .select("id, table_name, row_key, path, old_value, reverted_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!edit) throw new Error("That edit no longer exists.");
  const e = edit as {
    table_name: string;
    row_key: string;
    path: string | null;
    old_value: string | null;
  };
  if (!isTable(e.table_name)) throw new Error("Unsupported table.");

  if (e.path === "(insert)") {
    // an added FAQ entry is undone by unpublishing it, never by deleting data
    const { error: err } = await supabaseAdmin
      .from("cb_site_faq")
      .update({ is_published: false } as never)
      .eq("id", e.row_key);
    if (err) throw err;
  } else if (e.table_name === "cb_site_blocks") {
    const { data: row } = await supabaseAdmin
      .from("cb_site_blocks")
      .select("content")
      .eq("key", e.row_key)
      .maybeSingle();
    const content = JSON.parse(JSON.stringify((row as { content?: unknown } | null)?.content ?? {})) as Record<
      string,
      unknown
    >;
    setPath(content, e.path ?? "", e.old_value);
    const { error: err } = await supabaseAdmin
      .from("cb_site_blocks")
      .update({ content } as never)
      .eq("key", e.row_key);
    if (err) throw err;
  } else {
    const table = e.table_name as CbSiteAiTable;
    const col = e.path ?? "";
    if (!ALLOWED_COLUMNS[table].includes(col)) throw new Error("Unsupported field.");
    const value = col === "sort_order" ? Number(e.old_value) : e.old_value;
    const { error: err } = await supabaseAdmin
      .from(table)
      .update({ [col]: value } as never)
      .eq("id", e.row_key);
    if (err) throw err;
  }

  await supabaseAdmin
    .from("cb_site_edits")
    .update({ reverted_at: new Date().toISOString() } as never)
    .eq("id", id);
}

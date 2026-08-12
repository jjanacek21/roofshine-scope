import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * One cb_takeoffs row per job (upsert on job_id).
 * `data` holds the structured sheet, `elevations` holds per-elevation walk state.
 */

export const CB_ELEVATIONS = ["front", "right", "rear", "left"] as const;
export type CbElevation = (typeof CB_ELEVATIONS)[number];

export const CB_ELEVATION_LABEL: Record<CbElevation, string> = {
  front: "Front",
  right: "Right",
  rear: "Rear",
  left: "Left",
};

export interface CbItemEntry {
  qty?: number | null;
  note?: string;
  medium?: number;
  close?: number;
}

export interface CbElevationState {
  wide?: number;
  cleared?: boolean;
  items?: Record<string, CbItemEntry>;
  /** Roof walk */
  slopeWide?: number;
  testSquares?: { hits: number; at: string }[];
  roofItems?: Record<string, CbItemEntry>;
  done?: boolean;
}

export interface CbRoom {
  id: string;
  name: string;
  moisture?: number | null;
  note?: string;
  items?: Record<string, CbItemEntry>;
  photos?: number;
}

export interface CbTakeoffData {
  safety?: { stories?: number; access?: string; pitch?: string };
  rooms?: CbRoom[];
  [k: string]: unknown;
}

export interface CbTakeoff {
  job_id: string;
  data: CbTakeoffData;
  elevations: Partial<Record<CbElevation, CbElevationState>>;
}

const EMPTY: Omit<CbTakeoff, "job_id"> = { data: {}, elevations: {} };

export function useCbTakeoff(jobId: string) {
  const qc = useQueryClient();
  const key = ["cb-takeoff", jobId];

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<CbTakeoff> => {
      const { data, error } = await supabase
        .from("cb_takeoffs")
        .select("job_id, data, elevations")
        .eq("job_id", jobId)
        .maybeSingle();
      if (error) throw error;
      return {
        job_id: jobId,
        data: ((data?.data as CbTakeoffData) ?? {}) as CbTakeoffData,
        elevations: ((data?.elevations as CbTakeoff["elevations"]) ?? {}),
      };
    },
  });

  const save = useCallback(
    async (next: Omit<CbTakeoff, "job_id">) => {
      qc.setQueryData(key, { job_id: jobId, ...next });
      const { error } = await supabase
        .from("cb_takeoffs")
        .upsert(
          { job_id: jobId, data: next.data as never, elevations: next.elevations as never },
          { onConflict: "job_id" },
        );
      if (error) throw error;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobId, qc],
  );

  const current = query.data ?? { job_id: jobId, ...EMPTY };

  const patchElevation = useCallback(
    async (elev: CbElevation, patch: Partial<CbElevationState>) => {
      const prev = current.elevations[elev] ?? {};
      await save({
        data: current.data,
        elevations: { ...current.elevations, [elev]: { ...prev, ...patch } },
      });
    },
    [current, save],
  );

  const patchItem = useCallback(
    async (
      elev: CbElevation,
      bucket: "items" | "roofItems",
      itemKey: string,
      patch: Partial<CbItemEntry> | null,
    ) => {
      const prev = current.elevations[elev] ?? {};
      const items = { ...(prev[bucket] ?? {}) };
      if (patch === null) delete items[itemKey];
      else items[itemKey] = { ...(items[itemKey] ?? {}), ...patch };
      await save({
        data: current.data,
        elevations: { ...current.elevations, [elev]: { ...prev, [bucket]: items, cleared: false } },
      });
    },
    [current, save],
  );

  const patchData = useCallback(
    async (patch: Partial<CbTakeoffData>) => {
      await save({ data: { ...current.data, ...patch }, elevations: current.elevations });
    },
    [current, save],
  );

  return { takeoff: current, isLoading: query.isLoading, patchElevation, patchItem, patchData };
}

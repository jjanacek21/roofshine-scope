import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
}

export interface FriendProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  title: string | null;
}

export function useFriends(userId?: string) {
  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, FriendProfile>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    if (error) {
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as FriendshipRow[];
    setFriendships(rows);
    const otherIds = Array.from(
      new Set(rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id))),
    );
    if (otherIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, title")
        .in("id", otherIds);
      const map: Record<string, FriendProfile> = {};
      for (const p of (profs ?? []) as FriendProfile[]) map[p.id] = p;
      setProfiles(map);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const request = async (otherId: string) => {
    if (!userId || otherId === userId) return;
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: userId, addressee_id: otherId, status: "pending" });
    if (error) toast.error("Could not send request", { description: error.message });
    else toast.success("Friend request sent");
    await refresh();
  };

  const accept = async (id: string) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    await refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("friendships").delete().eq("id", id);
    if (error) toast.error(error.message);
    await refresh();
  };

  const accepted = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === userId);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === userId);

  return { friendships, profiles, accepted, incoming, outgoing, loading, request, accept, remove, refresh };
}

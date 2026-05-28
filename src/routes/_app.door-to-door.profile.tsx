import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useGamification } from "@/hooks/useGamification";
import { useFriends } from "@/hooks/useFriends";
import { supabase } from "@/integrations/supabase/client";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Zap, Flame, Award, Camera, UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { FeedList } from "@/components/feed/FeedList";

export const Route = createFileRoute("/_app/door-to-door/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { stats, badges, allBadges, loading: gamLoading, getProgressToNextLevel } = useGamification(user?.id);
  const { accepted, incoming, profiles: friendProfiles, accept, remove } = useFriends(user?.id);
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    toast.success("Avatar updated");
    setUploading(false);
    window.location.reload();
  };

  const progress = getProgressToNextLevel();
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "You";

  return (
    <div className="space-y-5 max-w-4xl mx-auto pt-4">
      {/* Header card */}
      <Card>
        <CardContent className="p-6 flex flex-col sm:flex-row gap-5 items-start">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 cursor-pointer text-primary-foreground">
              <Camera className="h-3.5 w-3.5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              {profile?.title && <p className="text-sm text-muted-foreground">{profile.title}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1"><Trophy className="h-3 w-3" /> {stats?.current_level?.replace(/_/g, " ") ?? "—"}</Badge>
              <Badge variant="secondary" className="gap-1"><Zap className="h-3 w-3" /> {stats?.total_points ?? 0} pts</Badge>
              <Badge variant="secondary" className="gap-1"><Flame className="h-3 w-3" /> {stats?.daily_streak ?? 0} day streak</Badge>
              <Badge variant="secondary" className="gap-1"><Award className="h-3 w-3" /> {badges.length} badges</Badge>
            </div>
            <div className="w-full max-w-sm pt-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${progress.percent}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{progress.current} / {progress.required} to next level</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Friends panel */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Friends</h2>
          {incoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Incoming requests</p>
              {incoming.map((f) => {
                const p = friendProfiles[f.requester_id];
                return (
                  <div key={f.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback>{(p?.first_name ?? "?").slice(0,1)}</AvatarFallback></Avatar>
                    <span className="text-sm flex-1">{[p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Someone"}</span>
                    <Button size="sm" variant="default" onClick={() => accept(f.id)}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline" onClick={() => remove(f.id)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                );
              })}
            </div>
          )}
          {accepted.length === 0 ? (
            <p className="text-xs text-muted-foreground">No friends yet. Search teammates and send a request.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accepted.map((f) => {
                const otherId = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
                const p = friendProfiles[otherId];
                return (
                  <div key={f.id} className="flex items-center gap-2 rounded-full border px-2 py-1" style={{ borderColor: "var(--border)" }}>
                    <Avatar className="h-6 w-6"><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback>{(p?.first_name ?? "?").slice(0,1)}</AvatarFallback></Avatar>
                    <span className="text-xs">{[p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Friend"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feed */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Network Feed</h2>
        <FeedComposer />
        <FeedList />
      </div>

      {/* Badges */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="text-sm font-semibold">Badges</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {allBadges.slice(0, 10).map((b) => {
              const earned = badges.some((ub) => ub.badge_id === b.id);
              return (
                <div key={b.id} className={`text-center p-3 rounded-lg border ${earned ? "" : "opacity-40"}`} style={{ borderColor: "var(--border)" }}>
                  <div className="text-2xl">{b.icon}</div>
                  <p className="text-[10px] mt-1 font-medium leading-tight">{b.name}</p>
                </div>
              );
            })}
            {gamLoading && <p className="text-xs text-muted-foreground col-span-5">Loading…</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

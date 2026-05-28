import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface Post {
  id: string;
  author_id: string;
  body: string | null;
  media: { url: string; type: string }[] | null;
  visibility: string;
  like_count: number;
  comment_count: number;
  created_at: string;
}

interface AuthorMap {
  [id: string]: { first_name: string | null; last_name: string | null; avatar_url: string | null };
}

export function FeedList() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [authors, setAuthors] = useState<AuthorMap>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("feed_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as Post[];
    setPosts(rows);
    const ids = Array.from(new Set(rows.map((p) => p.author_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", ids);
      const map: AuthorMap = {};
      for (const p of (profs ?? []) as any[]) map[p.id] = p;
      setAuthors(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("feed_posts_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("feed_post_likes")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      await supabase.from("feed_post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("feed_post_likes").insert({ post_id: postId, user_id: user.id });
    }
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading feed…</p>;
  if (posts.length === 0) return <p className="text-sm text-muted-foreground">No posts yet. Be the first.</p>;

  return (
    <div className="space-y-3">
      {posts.map((p) => {
        const a = authors[p.author_id];
        const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ") || "Member";
        return (
          <div key={p.id} className="rounded-2xl border bg-[var(--bg-card)] p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9"><AvatarImage src={a?.avatar_url ?? undefined} /><AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })} · {p.visibility}</p>
              </div>
            </div>
            {p.body && <p className="text-sm whitespace-pre-wrap">{p.body}</p>}
            {p.media && p.media.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {p.media.map((m, i) =>
                  m.type === "video" ? (
                    <video key={i} src={m.url} controls className="max-h-80 rounded-lg" />
                  ) : (
                    <img key={i} src={m.url} alt="" className="max-h-80 rounded-lg" />
                  ),
                )}
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
              <button onClick={() => toggleLike(p.id)} className="flex items-center gap-1.5 hover:text-foreground">
                <Heart className="h-3.5 w-3.5" /> {p.like_count}
              </button>
              <span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> {p.comment_count}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

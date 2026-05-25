import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { Video, Target, Clock, Home, Users, Zap, TrendingUp, Bell, ChevronUp, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FeedPost {
  id: string;
  session_id: string;
  user_id: string;
  video_url: string | null;
  video_type: 'goal' | 'progress' | 'roof' | 'homeowner';
  content: string | null;
  points_earned: number;
  doors_knocked: number;
  leads_gotten: number;
  goals_doors: number | null;
  goals_leads: number | null;
  created_at: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
  };
  reactions: { reaction_type: string; count: number }[];
  userReaction?: string;
  totalReactions: number;
}

interface SessionFeedProps {
  userId?: string;
  isOpen: boolean;
  onClose: () => void;
}

const REACTION_TYPES = ['🔥', '💪', '👏', '🎯', '⭐', '🚀'] as const;

const VIDEO_TYPE_CONFIG = {
  goal: { icon: Target, label: 'Goals Set', color: 'bg-blue-500', multiplier: '1x' },
  progress: { icon: Clock, label: 'Check-in', color: 'bg-primary', multiplier: '1x' },
  roof: { icon: Home, label: 'On Roof', color: 'bg-amber-500', multiplier: '2x' },
  homeowner: { icon: Users, label: 'With Homeowner', color: 'bg-green-500', multiplier: '3x' }
};

type FeedTab = 'following' | 'trending';

export function SessionFeed({ userId, isOpen, onClose }: SessionFeedProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FeedTab>('following');
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [lastSeenPostId, setLastSeenPostId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchPosts = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      // Fetch posts - order by reactions for trending, by date for following
      let query = supabase
        .from('session_feed_posts')
        .select('*')
        .limit(50);
      
      if (activeTab === 'trending') {
        query = query.order('points_earned', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      
      const { data: postsData, error } = await query;

      if (error) throw error;

      // Fetch profiles for all users
      const userIds = [...new Set((postsData || []).map(p => p.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);

      const profilesMap = new Map<string, { id: string; first_name: string | null; last_name: string | null }>(
        (profilesData || []).map(p => [p.id, p])
      );

      // Fetch reactions for each post
      const postsWithReactions = await Promise.all(
        (postsData || []).map(async (post) => {
          const { data: reactions } = await supabase
            .from('session_feed_reactions')
            .select('reaction_type, user_id')
            .eq('post_id', post.id);

          // Count reactions by type
          const reactionCounts = REACTION_TYPES.map(type => ({
            reaction_type: type,
            count: (reactions || []).filter(r => r.reaction_type === type).length
          })).filter(r => r.count > 0);

          const totalReactions = reactionCounts.reduce((sum, r) => sum + r.count, 0);

          // Check if current user reacted
          let userReaction: string | undefined;
          if (userId) {
            const userReact = (reactions || []).find(r => r.user_id === userId);
            userReaction = userReact?.reaction_type;
          }

          const profile = profilesMap.get(post.user_id);

          return {
            ...post,
            video_type: post.video_type as 'goal' | 'progress' | 'roof' | 'homeowner',
            profile: profile ? {
              first_name: profile.first_name,
              last_name: profile.last_name
            } : undefined,
            reactions: reactionCounts,
            userReaction,
            totalReactions
          } as FeedPost;
        })
      );

      setPosts(postsWithReactions);
      
      // Set initial last seen post
      if (postsWithReactions.length > 0 && !isRefresh) {
        setLastSeenPostId(postsWithReactions[0].id);
      }
    } catch (err) {
      console.error('Error fetching feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPosts();
      
      const channel = supabase
        .channel('session_feed')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'session_feed_posts' },
          () => {
            setNewPostsCount(prev => prev + 1);
            fetchPosts(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'session_feed_reactions' },
          () => fetchPosts(true)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, activeTab]);

  const scrollToTop = () => {
    setNewPostsCount(0);
    if (posts.length > 0) {
      setLastSeenPostId(posts[0].id);
    }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    if (!userId) return;

    const post = posts.find(p => p.id === postId);
    const hasReacted = post?.userReaction === reactionType;

    if (hasReacted) {
      // Remove reaction
      await supabase
        .from('session_feed_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('reaction_type', reactionType);
    } else {
      // Add reaction (upsert)
      await supabase
        .from('session_feed_reactions')
        .upsert({
          post_id: postId,
          user_id: userId,
          reaction_type: reactionType
        }, { 
          onConflict: 'post_id,user_id,reaction_type' 
        });
    }

    fetchPosts();
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
    >
      <div className="container max-w-lg mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="relative">
              <TrendingUp className="w-5 h-5 text-primary" />
              <Sparkles className="w-3 h-3 text-amber-500 absolute -top-1 -right-1" />
            </div>
            <h2 className="font-bold text-lg">Live Feed</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3 pb-2 border-b bg-background/60">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FeedTab)}>
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="following" className="text-sm">
                <Bell className="w-4 h-4 mr-1.5" />
                Following
              </TabsTrigger>
              <TabsTrigger value="trending" className="text-sm">
                <TrendingUp className="w-4 h-4 mr-1.5" />
                Trending
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* New Posts Notification */}
        <AnimatePresence>
          {newPostsCount > 0 && (
            <motion.button
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onClick={scrollToTop}
              className="absolute top-28 left-1/2 -translate-x-1/2 z-20 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
              <span className="font-medium">{newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'}</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Feed */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No session updates yet</p>
                <p className="text-sm">Start a session to see activity!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post, index) => {
                  const config = VIDEO_TYPE_CONFIG[post.video_type] || VIDEO_TYPE_CONFIG.progress;
                  const Icon = config.icon;
                  const doorsProgress = post.goals_doors ? (post.doors_knocked / post.goals_doors) * 100 : 0;
                  const leadsProgress = post.goals_leads ? (post.leads_gotten / post.goals_leads) * 100 : 0;
                  const showMultiplier = post.video_type === 'roof' || post.video_type === 'homeowner';

                  return (
                    <motion.div 
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow p-4 space-y-3"
                    >
                      {/* Header */}
                      <div className="flex items-start gap-3">
                        <Avatar className="w-11 h-11 ring-2 ring-primary/20">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-semibold">
                            {post.profile?.first_name?.[0] || 'U'}
                            {post.profile?.last_name?.[0] || ''}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">
                              {post.profile?.first_name || 'User'} {post.profile?.last_name || ''}
                            </p>
                            <Badge variant="secondary" className={`${config.color} text-white text-xs shrink-0`}>
                              <Icon className="w-3 h-3 mr-1" />
                              {config.label}
                            </Badge>
                            {showMultiplier && (
                              <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 bg-amber-50 shrink-0">
                                {config.multiplier} BONUS
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full border border-amber-500/30">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <span className="font-bold text-amber-600">+{post.points_earned}</span>
                        </div>
                      </div>

                      {/* Goal Panel - Show goals prominently */}
                      {post.goals_doors && (
                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between text-sm font-medium">
                            <span className="flex items-center gap-1.5">
                              <Target className="w-4 h-4 text-primary" />
                              Session Goals
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {post.doors_knocked + post.leads_gotten} / {(post.goals_doors || 0) + (post.goals_leads || 0)} total
                            </span>
                          </div>
                          
                          {/* Doors Progress */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Home className="w-3 h-3" /> Doors Knocked
                              </span>
                              <span className="font-semibold">{post.doors_knocked} / {post.goals_doors}</span>
                            </div>
                            <Progress value={Math.min(doorsProgress, 100)} className="h-2" />
                          </div>
                          
                          {/* Leads Progress */}
                          {post.goals_leads && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Users className="w-3 h-3" /> Leads Gotten
                                </span>
                                <span className="font-semibold text-green-600">{post.leads_gotten} / {post.goals_leads}</span>
                              </div>
                              <Progress value={Math.min(leadsProgress, 100)} className="h-2 [&>div]:bg-green-500" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Content */}
                      {post.content && (
                        <p className="text-sm text-foreground/90">{post.content}</p>
                      )}

                      {/* Video */}
                      {post.video_url && (
                        <div 
                          className="relative aspect-video bg-muted rounded-lg overflow-hidden cursor-pointer group"
                          onClick={() => setActiveVideoId(activeVideoId === post.id ? null : post.id)}
                        >
                          {activeVideoId === post.id ? (
                            <video
                              src={post.video_url}
                              className="w-full h-full object-cover"
                              controls
                              autoPlay
                              playsInline
                              muted
                              preload="auto"
                              onPlay={(e) => {
                                e.currentTarget.muted = false;
                              }}
                            />
                          ) : (
                            <>
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                                <div className="w-14 h-14 rounded-full bg-white/95 shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <Video className="w-6 h-6 text-primary" />
                                </div>
                              </div>
                              {showMultiplier && (
                                <div className="absolute top-2 right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow">
                                  {config.multiplier} POINTS
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* Reactions */}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex gap-1.5 flex-wrap">
                          {REACTION_TYPES.map((emoji) => {
                            const reaction = post.reactions.find(r => r.reaction_type === emoji);
                            const isSelected = post.userReaction === emoji;
                            return (
                              <motion.button
                                key={emoji}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleReaction(post.id, emoji)}
                                className={`px-2.5 py-1 rounded-full text-sm transition-all hover:scale-105 ${
                                  isSelected 
                                    ? 'bg-primary/20 ring-2 ring-primary shadow-sm' 
                                    : reaction?.count ? 'bg-muted hover:bg-muted/80' : 'hover:bg-muted'
                                }`}
                              >
                                <span className="text-base">{emoji}</span>
                                {reaction?.count ? (
                                  <span className="ml-1 text-xs font-medium">{reaction.count}</span>
                                ) : null}
                              </motion.button>
                            );
                          })}
                        </div>
                        {post.totalReactions > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {post.totalReactions} reaction{post.totalReactions !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  );
}

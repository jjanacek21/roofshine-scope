import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { 
  Video, Target, Clock, Home, Users, Zap, TrendingUp, 
  Bell, ChevronUp, X, Sparkles, MessageSquare, Image as ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { FeedPostComposer } from "./FeedPostComposer";
import { FeedComments } from "./FeedComments";
interface FeedPost {
  id: string;
  session_id: string;
  user_id: string;
  video_url: string | null;
  image_url: string | null;
  post_type: 'text' | 'photo' | 'video';
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
    avatar_url: string | null;
  };
  reactions: { reaction_type: string; count: number }[];
  userReaction?: string;
  totalReactions: number;
  commentCount: number;
}

interface FeedSidebarProps {
  userId?: string;
  isOpen: boolean;
  onToggle: () => void;
}

const REACTION_TYPES = ['🔥', '💪', '👏', '🎯', '⭐', '🚀'] as const;

const VIDEO_TYPE_CONFIG = {
  goal: { icon: Target, label: 'Goals', color: 'bg-blue-500', multiplier: '1x' },
  progress: { icon: Clock, label: 'Update', color: 'bg-primary', multiplier: '1x' },
  roof: { icon: Home, label: 'Roof', color: 'bg-amber-500', multiplier: '2x' },
  homeowner: { icon: Users, label: 'HO', color: 'bg-green-500', multiplier: '3x' }
};

type FeedTab = 'following' | 'team' | 'trending';

export function FeedSidebar({ userId, isOpen, onToggle }: FeedSidebarProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FeedTab>('following');
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<{first_name: string | null; last_name: string | null; avatar_url: string | null} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      setUserProfile(data);
    };
    fetchProfile();
  }, [userId]);

  // Fetch team members for "My Team" tab
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!userId) return;
      
      try {
        // Get user's company
        const { data: membership } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (membership?.company_id) {
          // Get all team member IDs
          const { data: teamMembers } = await supabase
            .from('company_members')
            .select('user_id')
            .eq('company_id', membership.company_id);

          setTeamMemberIds((teamMembers || []).map(m => m.user_id));
        }
      } catch (err) {
        console.error('Error fetching team members:', err);
      }
    };

    fetchTeamMembers();
  }, [userId]);

  const fetchPosts = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      let query = supabase
        .from('session_feed_posts')
        .select('*')
        .limit(30);
      
      // Apply tab-specific filtering
      if (activeTab === 'team' && teamMemberIds.length > 0) {
        query = query.in('user_id', teamMemberIds);
      }
      
      if (activeTab === 'trending') {
        query = query.order('points_earned', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      
      const { data: postsData, error } = await query;

      if (error) throw error;

      const userIds = [...new Set((postsData || []).map(p => p.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map<string, { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>(
        (profilesData || []).map(p => [p.id, p])
      );

      const postsWithReactions = await Promise.all(
        (postsData || []).map(async (post) => {
          // Fetch reactions
          const { data: reactions } = await supabase
            .from('session_feed_reactions')
            .select('reaction_type, user_id')
            .eq('post_id', post.id);

          // Fetch comment count
          const { count: commentCount } = await supabase
            .from('session_feed_comments')
            .select('id', { count: 'exact', head: true })
            .eq('post_id', post.id);

          const reactionCounts = REACTION_TYPES.map(type => ({
            reaction_type: type,
            count: (reactions || []).filter(r => r.reaction_type === type).length
          })).filter(r => r.count > 0);

          const totalReactions = reactionCounts.reduce((sum, r) => sum + r.count, 0);

          let userReaction: string | undefined;
          if (userId) {
            const userReact = (reactions || []).find(r => r.user_id === userId);
            userReaction = userReact?.reaction_type;
          }

          const profile = profilesMap.get(post.user_id);

          return {
            ...post,
            post_type: (post.post_type || 'video') as 'text' | 'photo' | 'video',
            video_type: (post.video_type || 'progress') as 'goal' | 'progress' | 'roof' | 'homeowner',
            profile: profile ? {
              first_name: profile.first_name,
              last_name: profile.last_name,
              avatar_url: profile.avatar_url
            } : undefined,
            reactions: reactionCounts,
            userReaction,
            totalReactions,
            commentCount: commentCount || 0
          } as FeedPost;
        })
      );

      setPosts(postsWithReactions);
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
        .channel('feed_sidebar')
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
  }, [isOpen, activeTab, teamMemberIds]);

  const handleReaction = async (postId: string, reactionType: string) => {
    if (!userId) return;

    const post = posts.find(p => p.id === postId);
    const hasReacted = post?.userReaction === reactionType;

    if (hasReacted) {
      await supabase
        .from('session_feed_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('reaction_type', reactionType);
    } else {
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

    fetchPosts(true);
  };

  const scrollToTop = () => {
    setNewPostsCount(0);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Toggle Button - Chat icon with notification badge */}
      <motion.button
        onClick={onToggle}
        className={cn(
          "fixed z-50 bg-card border shadow-lg rounded-l-xl p-2.5 transition-all hover:bg-accent",
          isOpen ? "right-80 md:right-96" : "right-0",
          !isOpen && newPostsCount > 0 && "animate-pulse ring-2 ring-primary shadow-primary/30"
        )}
        style={{ top: '50%', transform: 'translateY(-50%)' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="relative">
          <MessageSquare className={cn(
            "w-5 h-5",
            newPostsCount > 0 ? "text-primary" : "text-muted-foreground"
          )} />
          {!isOpen && newPostsCount > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center animate-bounce font-bold">
              {newPostsCount > 9 ? '9+' : newPostsCount}
            </span>
          )}
        </div>
      </motion.button>

      {/* Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-80 md:w-96 z-40 bg-background/95 backdrop-blur-md border-l shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-background/80">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <Sparkles className="w-3 h-3 text-amber-500 absolute -top-1 -right-1" />
                </div>
                <h2 className="font-bold">Live Feed</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Tabs - 3 columns: All, My Team, Hot */}
            <div className="px-3 pt-2 pb-1 bg-background/60">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FeedTab)}>
                <TabsList className="grid w-full grid-cols-3 h-8">
                  <TabsTrigger value="following" className="text-xs">
                    <Bell className="w-3 h-3 mr-1" />
                    All
                  </TabsTrigger>
                  <TabsTrigger value="team" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    My Team
                  </TabsTrigger>
                  <TabsTrigger value="trending" className="text-xs">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Hot
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* New Posts Notification */}
            <AnimatePresence>
              {newPostsCount > 0 && (
                <motion.button
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={scrollToTop}
                  className="mx-3 mt-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-full shadow flex items-center justify-center gap-1.5 text-sm hover:bg-primary/90"
                >
                  <ChevronUp className="w-3 h-3" />
                  {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Post Composer */}
            {userId && (
              <div className="px-3 py-2 border-b">
                <FeedPostComposer 
                  userId={userId}
                  userProfile={userProfile || undefined}
                  onPostCreated={() => fetchPosts(true)}
                />
              </div>
            )}

            {/* Feed Content */}
            <ScrollArea className="flex-1" ref={scrollRef}>
              <div className="p-3 space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Video className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {activeTab === 'team' ? 'No team updates yet' : 'No updates yet'}
                    </p>
                  </div>
                ) : (
                  posts.map((post, index) => {
                    const config = VIDEO_TYPE_CONFIG[post.video_type] || VIDEO_TYPE_CONFIG.progress;
                    const doorsProgress = post.goals_doors ? (post.doors_knocked / post.goals_doors) * 100 : 0;
                    const leadsProgress = post.goals_leads ? (post.leads_gotten / post.goals_leads) * 100 : 0;
                    const showMultiplier = post.video_type === 'roof' || post.video_type === 'homeowner';
                    const overallProgress = post.goals_doors 
                      ? Math.round((doorsProgress + leadsProgress) / 2) 
                      : 0;

                    return (
                      <motion.div 
                        key={post.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="bg-card rounded-lg border shadow-sm p-3 space-y-2.5"
                      >
                        {/* Header with Avatar */}
                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-10 h-10 ring-2 ring-background">
                            <AvatarImage src={post.profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                              {post.profile?.first_name?.[0] || 'U'}
                              {post.profile?.last_name?.[0] || ''}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-medium text-sm truncate">
                                {post.profile?.first_name || 'User'} {post.profile?.last_name?.[0] ? `${post.profile.last_name[0]}.` : ''}
                              </p>
                              <Badge variant="secondary" className={`${config.color} text-white text-[10px] px-1.5 py-0`}>
                                {config.label}
                              </Badge>
                              {showMultiplier && (
                                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] px-1.5 py-0 border-0">
                                  {config.multiplier} BONUS
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full">
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            <span className="font-bold text-sm text-amber-600">+{post.points_earned}</span>
                          </div>
                        </div>

                        {/* Enhanced Goal Panel */}
                        {post.goals_doors && (
                          <div className="bg-gradient-to-r from-muted/60 to-muted/40 rounded-lg p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5 text-primary" />
                                Goals Progress
                              </span>
                              <span className="text-xs text-muted-foreground font-medium">
                                {overallProgress}% complete
                              </span>
                            </div>
                            
                            {/* Doors Progress */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Home className="w-3 h-3" /> Doors
                                </span>
                                <span className="font-semibold text-amber-600">
                                  {post.doors_knocked}/{post.goals_doors}
                                </span>
                              </div>
                              <Progress 
                                value={Math.min(doorsProgress, 100)} 
                                className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-amber-400 [&>div]:to-amber-600" 
                              />
                            </div>
                            
                            {/* Leads Progress */}
                            {post.goals_leads && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Users className="w-3 h-3" /> Leads
                                  </span>
                                  <span className="font-semibold text-green-600">
                                    {post.leads_gotten}/{post.goals_leads}
                                  </span>
                                </div>
                                <Progress 
                                  value={Math.min(leadsProgress, 100)} 
                                  className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-green-400 [&>div]:to-green-600" 
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Image Display */}
                        {post.image_url && (
                          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                            <img
                              src={post.image_url}
                              alt="Post image"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Video Thumbnail */}
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
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                                  <Video className="w-5 h-5 text-primary ml-0.5" />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Text content */}
                        {post.content && (
                          <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                        )}

                        {/* All 6 Emoji Reactions */}
                        <div className="flex items-center gap-1 pt-1 flex-wrap">
                          {REACTION_TYPES.map((emoji) => {
                            const reaction = post.reactions.find(r => r.reaction_type === emoji);
                            const isSelected = post.userReaction === emoji;
                            return (
                              <motion.button
                                key={emoji}
                                onClick={() => handleReaction(post.id, emoji)}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-sm transition-all",
                                  isSelected 
                                    ? 'bg-primary/20 ring-1 ring-primary shadow-sm' 
                                    : reaction?.count 
                                      ? 'bg-muted hover:bg-muted/80' 
                                      : 'hover:bg-muted/60'
                                )}
                              >
                                {emoji}
                                {reaction?.count ? (
                                  <span className="ml-0.5 text-[10px] font-medium">{reaction.count}</span>
                                ) : null}
                              </motion.button>
                            );
                          })}
                          {post.totalReactions > 0 && (
                            <span className="text-[10px] text-muted-foreground ml-auto font-medium">
                              {post.totalReactions} reactions
                            </span>
                          )}
                        </div>

                        {/* Comments Section */}
                        <FeedComments
                          postId={post.id}
                          userId={userId}
                          initialCount={post.commentCount}
                        />
                      </motion.div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Send, CornerDownRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

interface FeedCommentsProps {
  postId: string;
  userId?: string;
  initialCount?: number;
}

export function FeedComments({ postId, userId, initialCount = 0 }: FeedCommentsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    if (!isExpanded) return;
    
    setLoading(true);
    try {
      // Fetch all comments for this post
      const { data: commentsData, error } = await supabase
        .from('session_feed_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles
      const userIds = [...new Set((commentsData || []).map(c => c.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map(
        (profilesData || []).map(p => [p.id, p])
      );

      // Organize into threaded structure
      const rootComments: Comment[] = [];
      const repliesMap = new Map<string, Comment[]>();

      (commentsData || []).forEach(comment => {
        const enrichedComment: Comment = {
          ...comment,
          profile: profilesMap.get(comment.user_id),
          replies: []
        };

        if (comment.parent_id) {
          const existing = repliesMap.get(comment.parent_id) || [];
          existing.push(enrichedComment);
          repliesMap.set(comment.parent_id, existing);
        } else {
          rootComments.push(enrichedComment);
        }
      });

      // Attach replies to parent comments
      rootComments.forEach(comment => {
        comment.replies = repliesMap.get(comment.id) || [];
      });

      setComments(rootComments);
      setCommentCount(commentsData?.length || 0);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch comments when expanded
  useEffect(() => {
    if (isExpanded) {
      fetchComments();
    }
  }, [isExpanded, postId]);

  // Real-time subscription
  useEffect(() => {
    if (!isExpanded) return;

    const channel = supabase
      .channel(`comments_${postId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'session_feed_comments',
          filter: `post_id=eq.${postId}`
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isExpanded, postId]);

  const handleSubmitComment = async (parentId?: string) => {
    if (!userId) return;
    
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('session_feed_comments')
        .insert({
          post_id: postId,
          user_id: userId,
          parent_id: parentId || null,
          content: content.trim()
        });

      if (error) throw error;

      // Clear input
      if (parentId) {
        setReplyContent('');
        setReplyingTo(null);
      } else {
        setNewComment('');
      }

      // Increment count optimistically
      setCommentCount(prev => prev + 1);
      
      // Refresh comments
      fetchComments();
    } catch (err) {
      console.error('Error submitting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-2",
        isReply && "ml-8 mt-2"
      )}
    >
      <Avatar className="w-7 h-7 flex-shrink-0">
        <AvatarImage src={comment.profile?.avatar_url || undefined} />
        <AvatarFallback className="bg-muted text-[10px] font-semibold">
          {comment.profile?.first_name?.[0] || 'U'}
          {comment.profile?.last_name?.[0] || ''}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="bg-muted/50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-xs">
              {comment.profile?.first_name || 'User'} {comment.profile?.last_name?.[0] ? `${comment.profile.last_name[0]}.` : ''}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm mt-0.5">{comment.content}</p>
        </div>
        
        {/* Reply button */}
        {!isReply && userId && (
          <button
            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            className="text-[10px] text-muted-foreground hover:text-primary mt-1 flex items-center gap-1"
          >
            <CornerDownRight className="w-3 h-3" />
            Reply
          </button>
        )}
        
        {/* Reply input */}
        <AnimatePresence>
          {replyingTo === comment.id && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 flex gap-2"
            >
              <Input
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitComment(comment.id);
                  }
                }}
              />
              <Button
                size="icon"
                className="h-8 w-8"
                onClick={() => handleSubmitComment(comment.id)}
                disabled={submitting || !replyContent.trim()}
              >
                {submitting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-2">
            {comment.replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} isReply />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="border-t pt-2 mt-2">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {commentCount > 0 ? (
          <span>{commentCount} comment{commentCount !== 1 ? 's' : ''}</span>
        ) : (
          <span>Add a comment</span>
        )}
      </button>

      {/* Comments section */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-3"
          >
            {/* New comment input */}
            {userId && (
              <div className="flex gap-2">
                <Input
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="h-8 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitComment();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleSubmitComment()}
                  disabled={submitting || !newComment.trim()}
                >
                  {submitting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                </Button>
              </div>
            )}

            {/* Comments list */}
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">
                No comments yet. Be the first!
              </p>
            ) : (
              <div className="space-y-3">
                {comments.map(comment => (
                  <CommentItem key={comment.id} comment={comment} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


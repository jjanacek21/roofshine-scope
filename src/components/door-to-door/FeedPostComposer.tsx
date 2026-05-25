import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  Video, Image, Send, X, Smile, AtSign, 
  StopCircle, Camera, Loader2 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FeedPostComposerProps {
  userId: string;
  userProfile?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  sessionId?: string;
  onPostCreated?: () => void;
}

const EMOJI_PICKER = ['😀', '🔥', '💪', '👏', '🎯', '⭐', '🚀', '🏠', '🛠️', '☀️', '🌧️', '❤️'];

type RecordingState = 'idle' | 'recording' | 'preview';

export function FeedPostComposer({ 
  userId, 
  userProfile,
  sessionId,
  onPostCreated 
}: FeedPostComposerProps) {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Media state
  const [mediaType, setMediaType] = useState<'none' | 'photo' | 'video'>('none');
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  
  // Video recording state
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // @mentions state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionUsers, setMentionUsers] = useState<Array<{id: string; first_name: string | null; last_name: string | null}>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Handle @mentions
  useEffect(() => {
    const fetchMentionUsers = async () => {
      if (!mentionSearch) {
        setMentionUsers([]);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .or(`first_name.ilike.%${mentionSearch}%,last_name.ilike.%${mentionSearch}%`)
        .limit(5);

      setMentionUsers(data || []);
    };

    if (showMentions) {
      fetchMentionUsers();
    }
  }, [mentionSearch, showMentions]);

  const handleContentChange = (value: string) => {
    setContent(value);
    
    // Check for @ symbol to trigger mentions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex >= 0) {
      const textAfterAt = value.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && textAfterAt.length <= 20) {
        setShowMentions(true);
        setMentionSearch(textAfterAt);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: {id: string; first_name: string | null; last_name: string | null}) => {
    const lastAtIndex = content.lastIndexOf('@');
    const newContent = content.substring(0, lastAtIndex) + `@${user.first_name || 'User'} `;
    setContent(newContent);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setContent(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  // Photo upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    setMediaType('photo');
    setMediaBlob(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
    setIsExpanded(true);
  };

  // Start video recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });

      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setMediaBlob(blob);
        setMediaPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
        setRecordingState('preview');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecordingState('recording');
      setMediaType('video');
      setRecordingDuration(0);
      setIsExpanded(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const clearMedia = () => {
    stopCamera();
    if (timerRef.current) clearInterval(timerRef.current);
    setMediaType('none');
    setMediaPreviewUrl(null);
    setMediaBlob(null);
    setRecordingState('idle');
    setRecordingDuration(0);
  };

  const handleSubmit = async () => {
    if (!content.trim() && !mediaBlob) {
      toast({ title: "Add some content or media", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      let mediaUrl: string | null = null;

      // Upload media if exists
      if (mediaBlob) {
        const fileExt = mediaType === 'photo' ? 'jpg' : 'webm';
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('feed-media')
          .upload(fileName, mediaBlob, {
            contentType: mediaType === 'photo' ? 'image/jpeg' : 'video/webm'
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('feed-media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
      }

      // Create post - if no sessionId, create a standalone post with a new field_session first
      let effectiveSessionId = sessionId;
      
      if (!effectiveSessionId) {
        // Create a temporary session for standalone posts
        const { data: newSession, error: sessionError } = await supabase
          .from('field_sessions')
          .insert({
            user_id: userId,
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
            is_active: false,
            total_doors: 0,
            total_points: 0,
            status: 'completed',
            goals_doors: 0,
            goals_leads: 0
          })
          .select('id')
          .single();
        
        if (sessionError) throw sessionError;
        effectiveSessionId = newSession.id;
      }

      const { error: insertError } = await supabase
        .from('session_feed_posts')
        .insert({
          user_id: userId,
          session_id: effectiveSessionId,
          content: content.trim() || null,
          post_type: mediaType === 'none' ? 'text' : mediaType,
          video_type: 'progress',
          points_earned: 10,
          doors_knocked: 0,
          leads_gotten: 0,
          image_url: mediaType === 'photo' ? mediaUrl : null,
          video_url: mediaType === 'video' ? mediaUrl : null
        });

      if (insertError) throw insertError;

      toast({ title: "Posted!", description: "Your update is now live" });
      
      // Reset state
      setContent('');
      clearMedia();
      setIsExpanded(false);
      onPostCreated?.();
    } catch (err) {
      console.error('Error creating post:', err);
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border shadow-sm p-3 space-y-3">
      {/* Compact view */}
      <div className="flex items-start gap-2">
        <Avatar className="w-9 h-9">
          <AvatarImage src={userProfile?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
            {userProfile?.first_name?.[0] || 'U'}
            {userProfile?.last_name?.[0] || ''}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            placeholder="Share an update..."
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            className={cn(
              "min-h-[40px] resize-none text-sm transition-all",
              isExpanded ? "min-h-[80px]" : ""
            )}
            disabled={isSubmitting}
          />
          
          {/* @Mentions dropdown */}
          <AnimatePresence>
            {showMentions && mentionUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute bottom-full left-0 mb-1 w-full bg-popover border rounded-lg shadow-lg z-50 max-h-40 overflow-auto"
              >
                {mentionUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => insertMention(user)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <AtSign className="w-3 h-3 text-muted-foreground" />
                    {user.first_name} {user.last_name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Media Preview */}
      <AnimatePresence>
        {(mediaPreviewUrl || recordingState === 'recording') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative aspect-video bg-muted rounded-lg overflow-hidden"
          >
            {recordingState === 'recording' ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                {/* Recording indicator */}
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-sm font-medium animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full" />
                  REC {recordingDuration}s
                </div>
              </>
            ) : mediaType === 'video' ? (
              <video
                src={mediaPreviewUrl!}
                className="w-full h-full object-cover"
                controls
              />
            ) : (
              <img
                src={mediaPreviewUrl!}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Clear media button */}
            {recordingState !== 'recording' && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={clearMedia}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-between border-t pt-3"
          >
            <div className="flex items-center gap-1">
              {/* Photo upload */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                  disabled={isSubmitting || recordingState === 'recording'}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isSubmitting || recordingState === 'recording'}
                  asChild
                >
                  <span>
                    <Image className="w-4 h-4 text-muted-foreground" />
                  </span>
                </Button>
              </label>

              {/* Video recording */}
              {recordingState === 'recording' ? (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={stopRecording}
                >
                  <StopCircle className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={startRecording}
                  disabled={isSubmitting || mediaType === 'photo'}
                >
                  <Camera className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}

              {/* Emoji picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={isSubmitting}
                  >
                    <Smile className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="grid grid-cols-6 gap-1">
                    {EMOJI_PICKER.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="w-8 h-8 text-lg hover:bg-muted rounded flex items-center justify-center"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* @mention button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setContent(prev => prev + '@');
                  textareaRef.current?.focus();
                }}
                disabled={isSubmitting}
              >
                <AtSign className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            {/* Submit button */}
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || (!content.trim() && !mediaBlob)}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Post
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


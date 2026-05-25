import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGamification } from '@/hooks/useGamification';

export interface SessionGoals {
  id: string;
  session_id: string;
  user_id: string;
  goals_doors: number;
  goals_leads: number;
  video_url: string;
  video_duration_seconds: number;
  created_at: string;
}

export interface ProgressVideo {
  id: string;
  session_id: string;
  user_id: string;
  video_url: string;
  video_duration_seconds: number;
  update_number: number;
  video_type: 'goal' | 'progress' | 'roof' | 'homeowner';
  points_multiplier: number;
  points_awarded: number;
  challenges_mentioned: string | null;
  updated_goals_doors: number | null;
  updated_goals_leads: number | null;
  created_at: string;
}

export function useSessionGoals(userId?: string, sessionId?: string) {
  const [goals, setGoals] = useState<SessionGoals | null>(null);
  const [progressVideos, setProgressVideos] = useState<ProgressVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastProgressCheck, setLastProgressCheck] = useState<number>(Date.now());
  const { awardPoints } = useGamification(userId);

  // Fetch session goals
  const fetchGoals = useCallback(async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('door_session_goals')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) throw error;
      setGoals(data as SessionGoals);
    } catch (err) {
      console.error('Error fetching session goals:', err);
    }
  }, [sessionId]);

  // Fetch progress videos for this session
  const fetchProgressVideos = useCallback(async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('session_progress_videos')
        .select('*')
        .eq('session_id', sessionId)
        .order('update_number', { ascending: true });

      if (error) throw error;
      setProgressVideos(data as ProgressVideo[]);
    } catch (err) {
      console.error('Error fetching progress videos:', err);
    }
  }, [sessionId]);

  // Record a progress video
  const recordProgressVideo = async (
    videoUrl: string,
    duration: number,
    videoType: 'progress' | 'roof' | 'homeowner',
    points: number
  ): Promise<boolean> => {
    if (!sessionId || !userId) return false;

    try {
      // Award points
      await awardPoints(
        points,
        'progress_video',
        `Progress video (${videoType}) recorded`
      );

      setLastProgressCheck(Date.now());
      await fetchProgressVideos();

      toast({
        title: `+${points} Points!`,
        description: `${videoType === 'roof' ? '2x Roof' : videoType === 'homeowner' ? '3x Homeowner' : 'Standard'} bonus applied!`
      });

      return true;
    } catch (err) {
      console.error('Error recording progress video:', err);
      return false;
    }
  };

  // Get the next update number
  const getNextUpdateNumber = (): number => {
    return progressVideos.length + 1;
  };

  // Check if hourly progress video is due
  const isProgressVideoDue = (sessionStartTime: Date): boolean => {
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000; // 1 hour
    const sessionDuration = now - sessionStartTime.getTime();
    const hoursElapsed = Math.floor(sessionDuration / hourInMs);
    
    // Check if we need a new progress video
    const videosRecorded = progressVideos.length;
    
    return hoursElapsed > videosRecorded && (now - lastProgressCheck) > 5 * 60 * 1000; // At least 5 min since last check
  };

  // Get current goals (may have been updated during session)
  const getCurrentGoals = (): { doors: number; leads: number } => {
    // Check if any progress video has updated goals
    const lastVideoWithGoals = [...progressVideos]
      .reverse()
      .find(v => v.updated_goals_doors || v.updated_goals_leads);

    return {
      doors: lastVideoWithGoals?.updated_goals_doors || goals?.goals_doors || 50,
      leads: lastVideoWithGoals?.updated_goals_leads || goals?.goals_leads || 5
    };
  };

  // Initial fetch
  useEffect(() => {
    if (sessionId) {
      setLoading(true);
      Promise.all([fetchGoals(), fetchProgressVideos()])
        .finally(() => setLoading(false));
    }
  }, [sessionId, fetchGoals, fetchProgressVideos]);

  return {
    goals,
    progressVideos,
    loading,
    hasSetGoals: !!goals,
    currentGoals: getCurrentGoals(),
    nextUpdateNumber: getNextUpdateNumber(),
    isProgressVideoDue,
    recordProgressVideo,
    refetch: () => {
      fetchGoals();
      fetchProgressVideos();
    }
  };
}

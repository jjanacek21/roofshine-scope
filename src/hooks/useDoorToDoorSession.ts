import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGamification } from '@/hooks/useGamification';

export type DoorDisposition = 
  | 'not_home'
  | 'not_interested'
  | 'go_back'
  | 'interested'
  | 'need_inspection'
  | 'storm_damage'
  | 'unqualified'
  | 'canvass_lead'
  | 'new_roof'
  | 'follow_up'
  | 'waiting'
  | 'already_solar'
  | 'opportunity'
  | 'commercial'
  | 'inspected'
  | 'old_roof'
  | 'won'
  // Legacy support
  | 'needs_inspection'
  | 'appointment_set'
  | 'contract_signed';

export interface FieldSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  total_doors: number;
  total_points: number;
  route_geojson: any;
  is_active: boolean;
}

export interface DoorKnock {
  id: string;
  session_id: string;
  user_id: string;
  lat: number;
  lng: number;
  address: string | null;
  disposition: DoorDisposition;
  dwell_time_seconds: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  appointment_date: string | null;
  points_awarded: number;
  notes: string | null;
  created_at: string;
}

export interface DoorToDooorStats {
  total_sessions: number;
  total_doors: number;
  total_points: number;
  total_appointments: number;
  total_contracts: number;
  total_verifications: number;
  current_streak_days: number;
  longest_streak_days: number;
}

// Points configuration - expanded for 18 dispositions
export const DOOR_POINTS = {
  base_knock: 5,
  not_home: 2,
  not_interested: 0,
  go_back: 3,
  interested: 10,
  need_inspection: 75,
  storm_damage: 15,
  unqualified: 0,
  canvass_lead: 25,
  new_roof: 50,
  follow_up: 5,
  waiting: 5,
  already_solar: 0,
  opportunity: 30,
  commercial: 10,
  inspected: 100,
  old_roof: 10,
  won: 200,
  // Legacy support
  needs_inspection: 75,
  appointment_set: 50,
  contract_signed: 200,
  // Bonus points
  customer_info: 20,
  video_verification: 25,
} as const;

export function useDoorToDoorSession(userId?: string) {
  const [activeSession, setActiveSession] = useState<FieldSession | null>(null);
  const [doorKnocks, setDoorKnocks] = useState<DoorKnock[]>([]);
  const [stats, setStats] = useState<DoorToDooorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { awardPoints } = useGamification(userId);

  // Fetch active session
  const fetchActiveSession = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('field_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active session:', error);
        return;
      }

      if (data) {
        setActiveSession(data as FieldSession);
        await fetchSessionKnocks(data.id);
      }
    } catch (err) {
      console.error('Error in fetchActiveSession:', err);
    }
  }, [userId]);

  // Fetch door knocks for a session
  const fetchSessionKnocks = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('door_knocks')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setDoorKnocks(data as DoorKnock[]);
    }
  };

  // Fetch user stats
  const fetchStats = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('door_to_door_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      setStats(data as DoorToDooorStats);
    }
  }, [userId]);

  // Start a new session
  const startSession = async (): Promise<FieldSession | null> => {
    if (!userId) return null;

    try {
      // End any existing active sessions first
      await supabase
        .from('field_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_active', true);

      const { data, error } = await supabase
        .from('field_sessions')
        .insert({
          user_id: userId,
          is_active: true,
          route_geojson: { type: 'LineString', coordinates: [] }
        })
        .select()
        .single();

      if (error) {
        console.error('Error starting session:', error);
        toast({
          title: 'Error',
          description: 'Failed to start session',
          variant: 'destructive'
        });
        return null;
      }

      const session = data as FieldSession;
      setActiveSession(session);
      setDoorKnocks([]);
      
      toast({
        title: '🚪 Session Started!',
        description: 'Start knocking doors to earn points!'
      });

      return session;
    } catch (err) {
      console.error('Error in startSession:', err);
      return null;
    }
  };

  // End current session
  const endSession = async (): Promise<void> => {
    if (!activeSession) return;

    try {
      const { error } = await supabase
        .from('field_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', activeSession.id);

      if (error) {
        console.error('Error ending session:', error);
        toast({
          title: 'Error',
          description: 'Failed to end session',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: '✅ Session Complete!',
        description: `You knocked ${activeSession.total_doors} doors and earned ${activeSession.total_points} points!`
      });

      setActiveSession(null);
      setDoorKnocks([]);
      await fetchStats();
    } catch (err) {
      console.error('Error in endSession:', err);
    }
  };

  // Calculate points for a door knock
  const calculatePoints = (
    disposition: DoorDisposition,
    hasCustomerInfo: boolean
  ): number => {
    let points = DOOR_POINTS.base_knock;
    
    // Get disposition points
    const dispositionKey = disposition as keyof typeof DOOR_POINTS;
    if (DOOR_POINTS[dispositionKey] !== undefined) {
      points += DOOR_POINTS[dispositionKey];
    }

    if (hasCustomerInfo) {
      points += DOOR_POINTS.customer_info;
    }

    return points;
  };

  // Record a door knock
  const recordDoorKnock = async (
    lat: number,
    lng: number,
    disposition: DoorDisposition,
    dwellTime: number,
    customerInfo?: {
      name?: string;
      phone?: string;
      email?: string;
      appointmentDate?: string;
    },
    notes?: string,
    address?: string
  ): Promise<DoorKnock | null> => {
    if (!activeSession || !userId) return null;

    try {
      const hasCustomerInfo = !!(customerInfo?.name || customerInfo?.phone || customerInfo?.email);
      const pointsAwarded = calculatePoints(disposition, hasCustomerInfo);

      const { data, error } = await supabase
        .from('door_knocks')
        .insert({
          session_id: activeSession.id,
          user_id: userId,
          lat,
          lng,
          address,
          disposition: disposition as any, // Cast for extended disposition types
          dwell_time_seconds: dwellTime,
          customer_name: customerInfo?.name || null,
          customer_phone: customerInfo?.phone || null,
          customer_email: customerInfo?.email || null,
          appointment_date: customerInfo?.appointmentDate || null,
          points_awarded: pointsAwarded,
          notes: notes || null
        } as any)
        .select()
        .single();

      if (error) {
        console.error('Error recording door knock:', error);
        toast({
          title: 'Error',
          description: 'Failed to record door knock',
          variant: 'destructive'
        });
        return null;
      }

      const knock = data as DoorKnock;
      setDoorKnocks(prev => [...prev, knock]);
      
      // Update local session totals
      setActiveSession(prev => prev ? {
        ...prev,
        total_doors: prev.total_doors + 1,
        total_points: prev.total_points + pointsAwarded
      } : null);

      // Also update the database session record (triggers should handle this, but ensure it's persisted)
      await supabase
        .from('field_sessions')
        .update({
          total_doors: (activeSession?.total_doors || 0) + 1,
          total_points: (activeSession?.total_points || 0) + pointsAwarded
        })
        .eq('id', activeSession.id);

      // Award points to gamification system
      await awardPoints(
        pointsAwarded,
        'door_knock',
        `Door knock: ${disposition.replace(/_/g, ' ')}`
      );

      // Show celebration for high-value dispositions
      if (disposition === 'won' || disposition === 'contract_signed') {
        toast({
          title: '🎉 CONTRACT WON!',
          description: `Amazing! +${pointsAwarded} points!`
        });
      } else if (disposition === 'inspected') {
        toast({
          title: '✅ Property Inspected!',
          description: `Great work! +${pointsAwarded} points!`
        });
      } else if (disposition === 'need_inspection' || disposition === 'needs_inspection') {
        toast({
          title: '🔍 Inspection Needed!',
          description: `Promising lead! +${pointsAwarded} points!`
        });
      } else if (disposition === 'canvass_lead') {
        toast({
          title: '👥 Lead Captured!',
          description: `Nice! +${pointsAwarded} points!`
        });
      } else {
        toast({
          title: `+${pointsAwarded} Points!`,
          description: `Door recorded: ${disposition.replace(/_/g, ' ')}`
        });
      }

      return knock;
    } catch (err) {
      console.error('Error in recordDoorKnock:', err);
      return null;
    }
  };

  // Record video verification
  const recordVideoVerification = async (
    videoUrl: string,
    durationSeconds: number
  ): Promise<boolean> => {
    if (!activeSession || !userId) return false;

    try {
      const { error } = await supabase
        .from('video_verifications')
        .insert({
          session_id: activeSession.id,
          user_id: userId,
          video_url: videoUrl,
          duration_seconds: durationSeconds,
          points_awarded: DOOR_POINTS.video_verification
        });

      if (error) {
        console.error('Error recording video verification:', error);
        return false;
      }

      // Award points
      await awardPoints(
        DOOR_POINTS.video_verification,
        'video_verification',
        'Video check-in completed'
      );

      toast({
        title: '📹 Video Verified!',
        description: `+${DOOR_POINTS.video_verification} points!`
      });

      return true;
    } catch (err) {
      console.error('Error in recordVideoVerification:', err);
      return false;
    }
  };

  // Update route GeoJSON
  const updateRoute = async (coordinates: [number, number][]) => {
    if (!activeSession) return;

    const routeGeoJson = {
      type: 'LineString',
      coordinates
    };

    await supabase
      .from('field_sessions')
      .update({ route_geojson: routeGeoJson })
      .eq('id', activeSession.id);

    setActiveSession(prev => prev ? { ...prev, route_geojson: routeGeoJson } : null);
  };

  // Save GPS location
  const saveLocation = async (lat: number, lng: number, accuracy: number) => {
    if (!activeSession || !userId) return;

    await supabase
      .from('user_locations')
      .insert({
        user_id: userId,
        session_id: activeSession.id,
        lat,
        lng,
        accuracy
      });
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchActiveSession(),
        fetchStats()
      ]);
      setLoading(false);
    };

    if (userId) {
      loadData();
    }
  }, [userId, fetchActiveSession, fetchStats]);

  return {
    activeSession,
    doorKnocks,
    stats,
    loading,
    startSession,
    endSession,
    recordDoorKnock,
    recordVideoVerification,
    updateRoute,
    saveLocation,
    calculatePoints,
    refetch: () => {
      fetchActiveSession();
      fetchStats();
    }
  };
}


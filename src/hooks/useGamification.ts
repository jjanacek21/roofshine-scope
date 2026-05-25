import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UserGamification {
  id: string;
  user_id: string;
  total_points: number;
  available_points: number;
  current_level: 'new_contractor' | 'rising_star' | 'network_pro' | 'master_referrer' | 'legend';
  current_streak: number;
  longest_streak: number;
  daily_streak: number;
  last_active_at: string;
  last_streak_action_at: string | null;
  monthly_points: number;
  monthly_referrals: number;
  total_referrals: number;
  successful_referrals: number;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  criteria_type: string;
  criteria_value: number;
  points_awarded: number;
  is_hidden: boolean;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  displayed: boolean;
  badge?: Badge;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  challenge_type: 'individual' | 'team' | 'company';
  target_metric: string;
  target_value: number;
  points_reward: number;
  badge_reward_id: string | null;
  bonus_payout_percent: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  user_progress?: number;
  user_completed?: boolean;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  reward_type: string;
  reward_value: string;
  is_available: boolean;
}

export const LEVEL_THRESHOLDS = {
  new_contractor: { min: 0, max: 499, name: 'New Contractor', perks: ['Basic access'] },
  rising_star: { min: 500, max: 1999, name: 'Rising Star', perks: ['Profile badge', '1 free boost/month'] },
  network_pro: { min: 2000, max: 4999, name: 'Network Pro', perks: ['Featured placement', 'Priority support'] },
  master_referrer: { min: 5000, max: 14999, name: 'Master Referrer', perks: ['Premium tools', '5% bonus on payouts'] },
  legend: { min: 15000, max: Infinity, name: 'Legend', perks: ['VIP status', 'Dedicated account manager'] },
};

export const POINT_VALUES = {
  daily_login: 10,
  daily_login_streak_bonus: 5,
  daily_login_streak_max: 50,
  profile_update: 5,
  referral_submitted: 50,
  referral_accepted: 100,
  referral_working: 50,
  referral_completed_base: 200,
  referral_completed_max: 500,
  job_photo_uploaded: 20,
  training_module: 50,
  full_verification: 300,
  client_reference: 25,
  recruit_contractor: 100,
  // Door to Door points
  door_knock_base: 5,
  door_not_home: 2,
  door_go_back: 3,
  door_interested: 10,
  door_customer_info: 20,
  door_appointment: 50,
  door_inspection: 75,
  door_contract: 200,
  door_video_verification: 25,
};

export function useGamification(userId?: string) {
  const [stats, setStats] = useState<UserGamification | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserStats = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching gamification stats:', error);
        return;
      }

      if (data) {
        setStats(data as UserGamification);
      } else {
        // Create initial record if doesn't exist
        const { data: newData, error: insertError } = await supabase
          .from('user_gamification')
          .insert({ user_id: userId })
          .select()
          .single();
        
        if (!insertError && newData) {
          setStats(newData as UserGamification);
        }
      }
    } catch (err) {
      console.error('Error in fetchUserStats:', err);
    }
  }, [userId]);

  const fetchUserBadges = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          *,
          badge:badges(*)
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user badges:', error);
        return;
      }

      setBadges(data as UserBadge[]);
    } catch (err) {
      console.error('Error in fetchUserBadges:', err);
    }
  }, [userId]);

  const fetchAllBadges = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .eq('is_active', true)
        .order('tier', { ascending: true });

      if (error) {
        console.error('Error fetching badges:', error);
        return;
      }

      setAllBadges(data as Badge[]);
    } catch (err) {
      console.error('Error in fetchAllBadges:', err);
    }
  }, []);

  const awardPoints = async (
    amount: number, 
    type: string, 
    description: string,
    referenceId?: string
  ) => {
    if (!userId || !stats) return false;

    try {
      // Note: The points_transactions table uses member_id for store members
      // For gamification, we track points directly in user_gamification table
      // We'll log the transaction description for reference
      console.log(`Awarding ${amount} points to user ${userId}: ${description}`);

      // Update user gamification directly
      // Update user gamification
      const newTotalPoints = stats.total_points + amount;
      const newAvailablePoints = stats.available_points + amount;
      const newMonthlyPoints = stats.monthly_points + amount;
      const newLevel = calculateLevel(newTotalPoints);

      const { error: updateError } = await supabase
        .from('user_gamification')
        .update({
          total_points: newTotalPoints,
          available_points: newAvailablePoints,
          monthly_points: newMonthlyPoints,
          current_level: newLevel,
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating gamification stats:', updateError);
        return false;
      }

      // Show toast
      toast({
        title: `+${amount} Points!`,
        description: description,
      });

      // Check for level up
      if (newLevel !== stats.current_level) {
        const levelInfo = LEVEL_THRESHOLDS[newLevel];
        toast({
          title: '🎉 Level Up!',
          description: `You've reached ${levelInfo.name}!`,
        });
      }

      // Refresh stats
      await fetchUserStats();
      
      // Check for new badges
      await checkBadgeEligibility();

      return true;
    } catch (err) {
      console.error('Error awarding points:', err);
      return false;
    }
  };

  const checkBadgeEligibility = async () => {
    if (!userId || !stats) return;

    try {
      // Get badges the user doesn't have yet
      const earnedBadgeIds = badges.map(b => b.badge_id);
      const unearnedBadges = allBadges.filter(b => !earnedBadgeIds.includes(b.id));

      for (const badge of unearnedBadges) {
        let qualified = false;

        if (badge.category === 'referral' && badge.criteria_type === 'count') {
          qualified = stats.successful_referrals >= badge.criteria_value;
        } else if (badge.category === 'streak' && badge.criteria_type === 'count') {
          if (badge.code.startsWith('daily_warrior')) {
            qualified = stats.daily_streak >= badge.criteria_value;
          } else {
            qualified = stats.current_streak >= badge.criteria_value;
          }
        }

        if (qualified) {
          await awardBadge(badge);
        }
      }
    } catch (err) {
      console.error('Error checking badge eligibility:', err);
    }
  };

  const awardBadge = async (badge: Badge) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_badges')
        .insert({
          user_id: userId,
          badge_id: badge.id,
        });

      if (error) {
        // Likely duplicate, ignore
        if (error.code !== '23505') {
          console.error('Error awarding badge:', error);
        }
        return;
      }

      toast({
        title: `${badge.icon} Badge Earned!`,
        description: `You've earned the "${badge.name}" badge!`,
      });

      // Award bonus points for the badge
      if (badge.points_awarded > 0) {
        await awardPoints(
          badge.points_awarded,
          'badge_earned',
          `Bonus points for earning ${badge.name} badge`
        );
      }

      await fetchUserBadges();
    } catch (err) {
      console.error('Error in awardBadge:', err);
    }
  };

  const updateStreak = async (type: 'referral' | 'daily') => {
    if (!userId || !stats) return;

    const now = new Date();
    const lastAction = stats.last_streak_action_at ? new Date(stats.last_streak_action_at) : null;
    const lastActive = new Date(stats.last_active_at);
    
    let updates: Partial<UserGamification> = {};

    if (type === 'referral') {
      updates.current_streak = stats.current_streak + 1;
      updates.longest_streak = Math.max(stats.longest_streak, updates.current_streak);
      updates.last_streak_action_at = now.toISOString();
    } else if (type === 'daily') {
      // Check if last active was yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isConsecutive = lastActive.toDateString() === yesterday.toDateString();
      
      if (isConsecutive) {
        updates.daily_streak = stats.daily_streak + 1;
      } else if (lastActive.toDateString() !== now.toDateString()) {
        updates.daily_streak = 1;
      }
      
      updates.last_active_at = now.toISOString();
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('user_gamification')
        .update(updates)
        .eq('user_id', userId);

      await fetchUserStats();
    }
  };

  const recordDailyLogin = async () => {
    if (!userId || !stats) return;

    const today = new Date().toDateString();
    const lastActive = new Date(stats.last_active_at).toDateString();

    if (today === lastActive) return; // Already logged in today

    await updateStreak('daily');

    // Calculate bonus points for streak
    const streakBonus = Math.min(
      stats.daily_streak * POINT_VALUES.daily_login_streak_bonus,
      POINT_VALUES.daily_login_streak_max
    );
    const totalPoints = POINT_VALUES.daily_login + streakBonus;

    await awardPoints(
      totalPoints,
      'daily_login',
      streakBonus > 0 
        ? `Daily login (+${streakBonus} streak bonus!)`
        : 'Daily login'
    );
  };

  const getProgressToNextLevel = () => {
    if (!stats) return { current: 0, required: 500, percent: 0, nextLevel: 'rising_star' as const };

    const currentThreshold = LEVEL_THRESHOLDS[stats.current_level];
    const levels = Object.entries(LEVEL_THRESHOLDS);
    const currentIndex = levels.findIndex(([key]) => key === stats.current_level);
    const nextLevel = currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;

    if (!nextLevel) {
      return { 
        current: stats.total_points, 
        required: currentThreshold.min, 
        percent: 100, 
        nextLevel: stats.current_level 
      };
    }

    const [nextLevelKey, nextThreshold] = nextLevel;
    const pointsInLevel = stats.total_points - currentThreshold.min;
    const pointsNeeded = nextThreshold.min - currentThreshold.min;
    const percent = Math.min((pointsInLevel / pointsNeeded) * 100, 100);

    return {
      current: pointsInLevel,
      required: pointsNeeded,
      percent,
      nextLevel: nextLevelKey as keyof typeof LEVEL_THRESHOLDS,
    };
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchUserStats(),
        fetchUserBadges(),
        fetchAllBadges(),
      ]);
      setLoading(false);
    };

    if (userId) {
      loadData();
    }
  }, [userId, fetchUserStats, fetchUserBadges, fetchAllBadges]);

  return {
    stats,
    badges,
    allBadges,
    loading,
    awardPoints,
    awardBadge,
    updateStreak,
    recordDailyLogin,
    getProgressToNextLevel,
    checkBadgeEligibility,
    refetch: () => {
      fetchUserStats();
      fetchUserBadges();
    },
  };
}

function calculateLevel(points: number): UserGamification['current_level'] {
  if (points >= 15000) return 'legend';
  if (points >= 5000) return 'master_referrer';
  if (points >= 2000) return 'network_pro';
  if (points >= 500) return 'rising_star';
  return 'new_contractor';
}

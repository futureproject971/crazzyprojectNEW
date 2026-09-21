export type RankTone = "blue" | "green" | "gold" | "pink" | "neutral";

export type RankTier = {
  code: string;
  label: string;
  min_points: number;
  color: string;
  tone: RankTone;
  icon: string;
  points_needed?: number;
};

export type RankBreakdown = {
  purchases: number;
  active_entitlements: number;
  reviews: number;
  rewards: number;
  luck_plays: number;
  community_messages: number;
  purchase_points: number;
  entitlement_points: number;
  review_points: number;
  reward_points: number;
  luck_points: number;
  community_points: number;
  total_points: number;
};

export type RankSnapshot = {
  points: number;
  current: RankTier;
  next: RankTier | null;
  progress_percent: number;
  breakdown: RankBreakdown;
};

export type RankLeaderboardItem = {
  position: number;
  user_id: string;
  name: string;
  avatar_url: string | null;
  primary_color: string;
  points: number;
  rank_code: string;
  rank_label: string;
  rank_color: string;
  rank_tone: RankTone;
};

export type RewardProduct = {
  id: string;
  campaign_id: string;
  product_id: string;
  product_plan_id: string | null;
  trial_duration_minutes: number;
  delivery_mode: string;
  auto_delay_seconds: number;
  product: { id: string; name: string; image_url: string | null } | null;
  plan: { id: string; name: string } | null;
};

export type RewardCampaign = {
  id: string;
  title: string;
  description: string;
  video_url: string;
  video_provider: string;
  required_watch_seconds: number;
  cooldown_hours: number;
  requirements: Record<string, unknown>;
  sort_order: number;
  products: RewardProduct[];
};

export type RewardSession = {
  id: string;
  campaign_id: string;
  campaign_product_id: string;
  product_id: string;
  product_plan_id: string | null;
  status: string;
  watched_seconds: number;
  requirements_completed?: {
    watch_guard?: {
      next_heartbeat_nonce?: string;
      checkpoint_active?: boolean;
      checkpoint_nonce?: string | null;
      checkpoint_at_seconds?: number;
      checkpoint_passed?: boolean;
    };
  };
  started_at: string;
  completed_at?: string | null;
  requested_at?: string | null;
  delivered_at?: string | null;
  cooldown_until?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type RewardHistoryItem = RewardSession & {
  campaign?: { id: string; title: string; description: string; required_watch_seconds: number; cooldown_hours: number } | null;
  product?: { id: string; name: string; image_url: string | null } | null;
  delivery?: { delivery_mode: string; delivered_at: string; expires_at: string | null } | null;
};

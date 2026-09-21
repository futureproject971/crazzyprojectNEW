export type LuckMode = "wheel" | "scratch" | "drop";

export type LuckPrize = {
  id: string;
  label: string;
  prize_type: "coupon" | "product" | "account" | "reward" | "none";
  sort_order: number;
  stock_remaining: number | null;
  chance_percent: number;
};

export type LuckCampaign = {
  id: string;
  slug: string;
  mode: LuckMode;
  title: string;
  description: string;
  free_plays_per_day: number;
  play_price_cents: number;
  daily_group: string;
  config: Record<string, unknown>;
  sort_order: number;
  prizes: LuckPrize[];
};

export type LuckResult = {
  play_id: string;
  campaign_slug: string;
  mode: LuckMode;
  prize_id: string;
  prize_label: string;
  prize_type: LuckPrize["prize_type"];
  random_roll: number;
  total_weight: number;
  chance_percent: number;
  coupon_code?: string;
  coupon_id?: string;
  coupon_expires_at?: string;
  delivery_status?: string;
};

export type LuckHistoryItem = {
  id: string;
  campaign_slug: string;
  campaign_title: string;
  mode: LuckMode;
  prize_label: string;
  prize_type: LuckPrize["prize_type"];
  status: string;
  result: LuckResult;
  created_at: string;
};

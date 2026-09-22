export type DiscordCampaignTarget = "all" | "online" | "role" | "single";
export type DiscordCampaignStatus = "queued" | "running" | "completed" | "cancelled" | "failed";

export type DiscordCampaignTemplate = {
  id: string;
  name: string;
  title: string | null;
  description: string;
  image_url: string | null;
  thumbnail_url: string | null;
  link_url: string | null;
  button_label: string;
  footer_text: string | null;
  color: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DiscordCampaign = {
  id: string;
  template_id: string | null;
  guild_id: string | null;
  title: string | null;
  description: string;
  image_url: string | null;
  thumbnail_url: string | null;
  link_url: string | null;
  button_label: string;
  footer_text: string | null;
  color: number;
  target_mode: DiscordCampaignTarget;
  target_role_id: string | null;
  target_user_id: string | null;
  status: DiscordCampaignStatus;
  cancel_requested: boolean;
  scheduled_for: string;
  total_recipients: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  worker_id: string | null;
  last_error: string | null;
  queued_at: string;
  started_at: string | null;
  heartbeat_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DiscordWorkerRole = {
  id: string;
  name: string;
  color?: number;
  position?: number;
  member_count?: number;
};

export type DiscordCampaignWorker = {
  worker_id: string;
  guild_id: string | null;
  guild_name: string | null;
  bot_user_id: string | null;
  bot_tag: string | null;
  connected: boolean;
  member_count: number;
  online_count: number;
  roles: DiscordWorkerRole[];
  version: string | null;
  last_error: string | null;
  last_seen_at: string;
};

export type DiscordCampaignCenterPayload = {
  templates: DiscordCampaignTemplate[];
  campaigns: DiscordCampaign[];
  workers: DiscordCampaignWorker[];
  admin_discord_user_id: string | null;
};

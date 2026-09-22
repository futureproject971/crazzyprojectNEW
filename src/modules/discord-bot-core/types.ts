export type DiscordBuilderChannel = {
  name: string;
  type: "text";
  readOnly?: boolean;
};

export type DiscordBuilderCategory = {
  name: string;
  channels: DiscordBuilderChannel[];
};

export type DiscordBuilderTemplate = {
  brand?: string;
  theme?: string;
  categories: DiscordBuilderCategory[];
};

export type DiscordBuilderTheme = {
  brand?: string;
  primary?: string;
  secondary?: string;
  accent?: string;
  success?: string;
  danger?: string;
  dark?: string;
  footer?: string;
};

export type DiscordBuilderConfig = {
  id: string;
  template: DiscordBuilderTemplate;
  theme: DiscordBuilderTheme;
  safe_mode: true;
  updated_at: string;
};

export type DiscordBotChannelSnapshot = {
  id: string;
  name: string;
  type: "category" | "text" | "voice";
  parent_id: string | null;
  position: number;
};

export type DiscordBotWorker = {
  worker_id: string;
  guild_id: string | null;
  guild_name: string | null;
  bot_user_id: string | null;
  bot_tag: string | null;
  connected: boolean;
  member_count: number;
  online_count: number;
  roles: Array<{ id: string; name: string; color?: number; position?: number; member_count?: number }>;
  channels: DiscordBotChannelSnapshot[];
  version: string | null;
  last_error: string | null;
  last_seen_at: string;
};

export type DiscordBuilderJob = {
  id: string;
  guild_id: string | null;
  status: "queued" | "running" | "completed" | "cancelled" | "failed";
  safe_mode: true;
  cancel_requested: boolean;
  worker_id: string | null;
  planned_items: Array<Record<string, unknown>>;
  report: Array<Record<string, unknown>>;
  created_count: number;
  preserved_count: number;
  last_error: string | null;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DiscordBotCorePayload = {
  worker: DiscordBotWorker | null;
  builder: DiscordBuilderConfig;
  jobs: DiscordBuilderJob[];
  campaign_summary: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
  };
};

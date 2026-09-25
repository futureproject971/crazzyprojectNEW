export type Customer360Row = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  banned: boolean;
  banned_at: string | null;
  created_at: string;
  email: string | null;
  last_sign_in_at: string | null;
  discord_user_id: string | null;
  discord_username: string | null;
  discord_global_name: string | null;
  discord_avatar_url: string | null;
  guild_member: boolean;
  roles: string[];
  payment_count: number;
  completed_payment_count: number;
  paid_total_cents: number;
  active_entitlements: number;
  open_tickets: number;
};

export type Customer360Snapshot = {
  account: {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    banned: boolean;
    banned_at: string | null;
    banned_reason: string | null;
    created_at: string;
    updated_at: string;
    email: string | null;
    last_sign_in_at: string | null;
  };
  discord: null | {
    discord_user_id: string | null;
    username: string | null;
    global_name: string | null;
    avatar_url: string | null;
    guild_id: string | null;
    guild_member: boolean;
    guild_verified_at: string | null;
    last_checked_at: string | null;
  };
  roles: string[];
  stats: {
    payment_count: number;
    completed_payment_count: number;
    paid_total_cents: number;
    active_entitlements: number;
    deliveries: number;
    open_tickets: number;
    discord_roles: number;
  };
  payments: Array<Record<string, any>>;
  orders: Array<Record<string, any>>;
  entitlements: Array<Record<string, any>>;
  deliveries: Array<Record<string, any>>;
  tickets: Array<Record<string, any>>;
  discord_role_grants: Array<Record<string, any>>;\n  club: { bonus_balance_cents: number; reward_sessions: number; luck_plays: number; coupons: number };
};

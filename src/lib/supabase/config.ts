export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://nnmglkdpmffmaiuwbcct.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_Gu8G1uqggVf2pvVenX7EPQ_yIi5t2Kb";

export const GOOGLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

export const DISCORD_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DISCORD_AUTH !== "false";

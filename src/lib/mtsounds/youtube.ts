import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";

export type YouTubeConnection = {
  user_id: string;
  google_sub: string | null;
  email: string | null;
  display_name: string | null;
  channel_id: string | null;
  channel_title: string | null;
  refresh_token: string;
  access_token: string | null;
  token_expires_at: string | null;
  scopes: string[];
};

export function youtubeOAuthConfig() {
  const clientId = String(process.env.GOOGLE_YOUTUBE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.GOOGLE_YOUTUBE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    throw new Error("YOUTUBE_OAUTH_NOT_CONFIGURED");
  }
  return { clientId, clientSecret };
}

export async function getYouTubeConnection(userId: string) {
  const service = createServiceRoleSupabaseClient();
  const { data, error } = await service
    .from("youtube_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as YouTubeConnection | null;
}

export async function deleteYouTubeConnection(userId: string) {
  const service = createServiceRoleSupabaseClient();
  const { error } = await service
    .from("youtube_connections")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

export async function saveYouTubeConnection(
  userId: string,
  payload: {
    googleSub?: string | null;
    email?: string | null;
    displayName?: string | null;
    channelId?: string | null;
    channelTitle?: string | null;
    refreshToken: string;
    accessToken?: string | null;
    expiresIn?: number | null;
    scopes?: string[];
  }
) {
  const service = createServiceRoleSupabaseClient();
  const expiresAt = payload.expiresIn
    ? new Date(Date.now() + payload.expiresIn * 1000).toISOString()
    : null;

  const { error } = await service.from("youtube_connections").upsert(
    {
      user_id: userId,
      google_sub: payload.googleSub || null,
      email: payload.email || null,
      display_name: payload.displayName || null,
      channel_id: payload.channelId || null,
      channel_title: payload.channelTitle || null,
      refresh_token: payload.refreshToken,
      access_token: payload.accessToken || null,
      token_expires_at: expiresAt,
      scopes: payload.scopes || [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

async function exchangeRefreshToken(refreshToken: string) {
  const { clientId, clientSecret } = youtubeOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload?.error || "YOUTUBE_TOKEN_REFRESH_FAILED");
  }
  return {
    accessToken: String(payload.access_token),
    expiresIn: Number(payload.expires_in || 3600),
    scopes: String(payload.scope || "")
      .split(" ")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export async function getYouTubeAccessToken(userId: string) {
  const connection = await getYouTubeConnection(userId);
  if (!connection?.refresh_token) throw new Error("YOUTUBE_NOT_CONNECTED");

  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;

  if (
    connection.access_token &&
    expiresAt > Date.now() + 60_000
  ) {
    return { token: connection.access_token, connection };
  }

  const refreshed = await exchangeRefreshToken(connection.refresh_token);
  const service = createServiceRoleSupabaseClient();
  const nextExpiry = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
  const { error } = await service
    .from("youtube_connections")
    .update({
      access_token: refreshed.accessToken,
      token_expires_at: nextExpiry,
      scopes: refreshed.scopes.length ? refreshed.scopes : connection.scopes,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw error;

  return {
    token: refreshed.accessToken,
    connection: {
      ...connection,
      access_token: refreshed.accessToken,
      token_expires_at: nextExpiry,
    },
  };
}

export async function youtubeApi<T>(
  userId: string,
  path: string,
  params: Record<string, string>
) {
  const { token } = await getYouTubeAccessToken(userId);
  const search = new URLSearchParams(params);
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/" + path + "?" + search.toString(),
    {
      cache: "no-store",
      headers: { Authorization: "Bearer " + token },
    }
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "YOUTUBE_API_FAILED");
  }
  return payload as T;
}

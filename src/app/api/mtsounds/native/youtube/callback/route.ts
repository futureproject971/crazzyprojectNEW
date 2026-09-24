import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getYouTubeConnection,
  saveYouTubeConnection,
  youtubeOAuthConfig,
} from "@/lib/mtsounds/youtube";

export async function GET(request: NextRequest) {
  const destination = new URL("/mtsounds#youtube-account", request.url);
  const errorFromGoogle = request.nextUrl.searchParams.get("error");
  if (errorFromGoogle) {
    destination.searchParams.set("youtube", "cancelled");
    return NextResponse.redirect(destination);
  }

  const code = String(request.nextUrl.searchParams.get("code") || "");
  const state = String(request.nextUrl.searchParams.get("state") || "");
  const storedState = request.cookies.get("crz_yt_oauth_state")?.value || "";
  if (!code || !state || !storedState || state !== storedState) {
    destination.searchParams.set("youtube", "invalid-state");
    return NextResponse.redirect(destination);
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=%2Fmtsounds", request.url));
  }

  try {
    const { clientId, clientSecret } = youtubeOAuthConfig();
    const redirectUri =
      request.nextUrl.origin + "/api/mtsounds/native/youtube/callback";

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) {
      throw new Error(token?.error || "YOUTUBE_TOKEN_EXCHANGE_FAILED");
    }

    const [profileResponse, channelResponse] = await Promise.all([
      fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        cache: "no-store",
        headers: { Authorization: "Bearer " + token.access_token },
      }),
      fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true",
        {
          cache: "no-store",
          headers: { Authorization: "Bearer " + token.access_token },
        }
      ),
    ]);

    const profile = await profileResponse.json().catch(() => ({}));
    const channelPayload = await channelResponse.json().catch(() => ({}));
    const channel = channelPayload?.items?.[0] || null;
    const previous = await getYouTubeConnection(user.id);
    const refreshToken = String(
      token.refresh_token || previous?.refresh_token || ""
    );
    if (!refreshToken) throw new Error("YOUTUBE_REFRESH_TOKEN_MISSING");

    await saveYouTubeConnection(user.id, {
      googleSub: profile?.sub || null,
      email: profile?.email || null,
      displayName: profile?.name || null,
      channelId: channel?.id || null,
      channelTitle: channel?.snippet?.title || null,
      refreshToken,
      accessToken: String(token.access_token),
      expiresIn: Number(token.expires_in || 3600),
      scopes: String(token.scope || "")
        .split(" ")
        .map((item) => item.trim())
        .filter(Boolean),
    });

    destination.searchParams.set("youtube", "connected");
  } catch {
    destination.searchParams.set("youtube", "failed");
  }

  const response = NextResponse.redirect(destination);
  response.cookies.set("crz_yt_oauth_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

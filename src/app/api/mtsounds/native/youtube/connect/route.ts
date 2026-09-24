import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { youtubeOAuthConfig } from "@/lib/mtsounds/youtube";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=%2Fmtsounds", request.url));
  }

  let clientId = "";
  try {
    clientId = youtubeOAuthConfig().clientId;
  } catch {
    return NextResponse.json({ error: "YOUTUBE_OAUTH_NOT_CONFIGURED" }, { status: 503 });
  }

  const state = crypto.randomUUID();
  const redirectUri =
    request.nextUrl.origin + "/api/mtsounds/native/youtube/callback";
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set(
    "scope",
    [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/youtube.readonly",
    ].join(" ")
  );
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("include_granted_scopes", "true");
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("state", state);

  const response = NextResponse.redirect(auth);
  response.cookies.set("crz_yt_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}

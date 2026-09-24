import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function loginError(request: NextRequest, code: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

function guildGate(request: NextRequest, next: string) {
  const url = new URL("/entrar/servidor", request.url);
  url.searchParams.set("next", safeNext(next));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const expectedProvider = request.nextUrl.searchParams.get("provider");

  if (!code) return loginError(request, "missing_code");
  if (expectedProvider !== "discord") return loginError(request, "discord_only");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) return loginError(request, "oauth_exchange");

  const providerToken = data.session.provider_token || "";
  if (!providerToken) {
    await supabase.auth.signOut();
    return loginError(request, "discord_token_missing");
  }

  try {
    const syncResponse = await fetch(SUPABASE_URL + "/functions/v1/auth-discord-sync", {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: "Bearer " + data.session.access_token,
      },
      body: JSON.stringify({ provider_token: providerToken }),
    });

    const sync = await syncResponse.json().catch(() => null);

    if (syncResponse.status === 403 && sync?.error === "ACCOUNT_BANNED") {
      await supabase.auth.signOut();
      return loginError(request, "banned");
    }
    if (!syncResponse.ok) {
      await supabase.auth.signOut();
      return loginError(request, "discord_sync");
    }
    if (sync?.guildCheckConfigured !== true) {
      await supabase.auth.signOut();
      return loginError(request, "discord_guild_not_configured");
    }
    if (sync?.guildMember !== true) {
      await supabase.auth.signOut();
      return guildGate(request, next);
    }

    const referralCode = request.cookies.get("crz_partner_ref")?.value || "";
    if (referralCode) {
      try {
        await supabase.rpc("capture_my_partner_attribution", {
          p_code: referralCode,
          p_source: "discord_callback",
        });
      } catch {
        // Referral attribution must never block a valid Discord login.
      }
    }

    return NextResponse.redirect(new URL(next, request.url));
  } catch {
    await supabase.auth.signOut();
    return loginError(request, "discord_sync");
  }
}

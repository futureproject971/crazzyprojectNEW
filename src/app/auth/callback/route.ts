import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/lib/supabase/config";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function loginError(request: NextRequest, code: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const expectedProvider = request.nextUrl.searchParams.get("provider");

  if (!code) return loginError(request, "missing_code");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return loginError(request, "oauth_exchange");
  }

  if (expectedProvider === "discord") {
    const providerToken = data.session.provider_token || "";

    if (providerToken) {
      try {
        const syncResponse = await fetch(
          SUPABASE_URL + "/functions/v1/auth-discord-sync",
          {
            method: "POST",
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              apikey: SUPABASE_PUBLISHABLE_KEY,
              Authorization: "Bearer " + data.session.access_token,
            },
            body: JSON.stringify({ provider_token: providerToken }),
          }
        );

        const sync = await syncResponse.json().catch(() => null);

        if (syncResponse.status === 403 && sync?.error === "ACCOUNT_BANNED") {
          await supabase.auth.signOut();
          return loginError(request, "banned");
        }

        const destination = new URL(next, request.url);
        if (!syncResponse.ok) {
          destination.searchParams.set("auth_warning", "discord_sync");
        } else if (
          sync?.guildCheckConfigured === true &&
          sync?.guildMember === false
        ) {
          destination.searchParams.set("discord_guild", "not_member");
        }

        return NextResponse.redirect(destination);
      } catch {
        const destination = new URL(next, request.url);
        destination.searchParams.set("auth_warning", "discord_sync");
        return NextResponse.redirect(destination);
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}

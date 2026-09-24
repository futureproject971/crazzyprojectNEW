import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  deleteYouTubeConnection,
  getYouTubeConnection,
} from "@/lib/mtsounds/youtube";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  try {
    const connection = await getYouTubeConnection(user.id);
    const token = connection?.access_token || connection?.refresh_token || "";
    if (token) {
      await fetch(
        "https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token),
        { method: "POST", cache: "no-store" }
      ).catch(() => undefined);
    }
    await deleteYouTubeConnection(user.id);
    return NextResponse.json({ disconnected: true });
  } catch {
    return NextResponse.json({ error: "YOUTUBE_DISCONNECT_FAILED" }, { status: 500 });
  }
}

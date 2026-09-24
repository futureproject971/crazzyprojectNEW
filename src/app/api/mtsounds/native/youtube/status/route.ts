import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getYouTubeConnection } from "@/lib/mtsounds/youtube";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false }, { status: 401 });

  try {
    const connection = await getYouTubeConnection(user.id);
    return NextResponse.json({
      connected: Boolean(connection),
      account: connection
        ? {
            email: connection.email,
            displayName: connection.display_name,
            channelId: connection.channel_id,
            channelTitle: connection.channel_title,
          }
        : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { connected: false, error: error instanceof Error ? error.message : "STATUS_FAILED" },
      { status: 503 }
    );
  }
}

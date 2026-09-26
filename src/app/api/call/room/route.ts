import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });

  const { data, error } = await supabase.rpc("get_call_room_snapshot", { p_code: code });
  if (error || !data) return callErrorResponse(error?.message, "ROOM_SNAPSHOT_FAILED");

  const { data: voiceAllowed, error: voiceError } = await supabase.rpc(
    "check_call_voice_presence",
    { p_call_room_id: data.room.id },
  );
  if (voiceError) {
    return NextResponse.json({ error: "VOICE_PRESENCE_CHECK_FAILED" }, { status: 503 });
  }
  if (voiceAllowed === false) {
    return NextResponse.json({ error: "DISCORD_VOICE_REQUIRED" }, { status: 403 });
  }

  return NextResponse.json({ snapshot: data }, { headers: { "Cache-Control": "no-store" } });
}

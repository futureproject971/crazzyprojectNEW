import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";
import { createLiveKitJoinToken, isLiveKitConfigured } from "@/lib/call/livekit-server";
import type { CallRoomSnapshot } from "@/modules/call/types";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  if (!isLiveKitConfigured()) {
    return NextResponse.json({ error: "LIVEKIT_NOT_CONFIGURED" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });

  const { data, error } = await supabase.rpc("get_call_room_snapshot", { p_code: code });
  if (error || !data) return callErrorResponse(error?.message, "ROOM_SNAPSHOT_FAILED");

  const snapshot = data as CallRoomSnapshot;
  if (snapshot.room.status === "ended" || snapshot.room.status === "disabled") {
    return NextResponse.json({ error: "ROOM_ENDED" }, { status: 409 });
  }

  const participant = snapshot.participants.find((item) => item.user_id === user.id);
  if (!participant || participant.kicked_at || participant.left_at) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const credentials = await createLiveKitJoinToken({
      room: snapshot.room,
      userId: user.id,
      displayName: participant.display_name,
      role: participant.role,
    });
    return NextResponse.json(credentials, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (tokenError) {
    const message = tokenError instanceof Error ? tokenError.message : "LIVEKIT_TOKEN_FAILED";
    if (message === "LIVEKIT_NOT_CONFIGURED") {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: "LIVEKIT_TOKEN_FAILED" }, { status: 502 });
  }
}

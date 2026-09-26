import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const body = await request.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!code) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });

  const { data: preview, error: previewError } = await supabase.rpc("get_call_room_preview", {
    p_code: code,
  });
  if (previewError || !preview) return callErrorResponse(previewError?.message, "ROOM_PREVIEW_FAILED");

  const { data: voiceAllowed, error: voiceError } = await supabase.rpc(
    "check_call_voice_presence",
    { p_call_room_id: preview.id },
  );
  if (voiceError) {
    return NextResponse.json({ error: "VOICE_PRESENCE_CHECK_FAILED" }, { status: 503 });
  }
  if (voiceAllowed === false) {
    return NextResponse.json({ error: "DISCORD_VOICE_REQUIRED" }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("join_call_room_secure", {
    p_code: code,
    p_display_name: displayName,
    p_password: password,
  });

  if (error || !data) return callErrorResponse(error?.message, "ROOM_JOIN_FAILED");
  if (data.ok === false) return NextResponse.json(data, { status: 401 });
  return NextResponse.json({ snapshot: data });
}

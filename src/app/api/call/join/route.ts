import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const body = await request.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : null;
  if (!code) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });

  const { data, error } = await supabase.rpc("join_call_room", {
    p_code: code,
    p_display_name: displayName,
  });

  if (error || !data) return callErrorResponse(error?.message, "ROOM_JOIN_FAILED");
  return NextResponse.json({ snapshot: data });
}

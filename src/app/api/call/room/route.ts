import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });

  const { data, error } = await supabase.rpc("get_call_room_snapshot", { p_code: code });
  if (error || !data) return callErrorResponse(error?.message, "ROOM_SNAPSHOT_FAILED");

  return NextResponse.json({ snapshot: data }, { headers: { "Cache-Control": "no-store" } });
}

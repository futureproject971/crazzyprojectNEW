import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const roomId = request.nextUrl.searchParams.get("roomId") || "";
  if (!roomId) return NextResponse.json({ error: "INVALID_ROOM" }, { status: 400 });

  const { data, error } = await supabase
    .from("call_messages")
    .select("id,room_id,user_id,message,created_at,deleted_at")
    .eq("room_id", roomId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(150);

  if (error) return callErrorResponse(error.message, "CHAT_LOAD_FAILED");
  return NextResponse.json({ messages: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const body = await request.json().catch(() => ({}));
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  const message = typeof body?.message === "string" ? body.message : "";
  if (!roomId || !message.trim()) {
    return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("send_call_message", {
    p_room_id: roomId,
    p_message: message,
  });
  if (error || !data) return callErrorResponse(error?.message, "CHAT_SEND_FAILED");
  return NextResponse.json({ message: data }, { status: 201 });
}

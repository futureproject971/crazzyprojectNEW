import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const body = await request.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title : null;
  const roomMode = body?.roomMode === "live" ? "live" : "call";
  const password = typeof body?.password === "string" ? body.password : "";
  const maxParticipants = Number.isFinite(Number(body?.maxParticipants))
    ? Number(body.maxParticipants)
    : 20;

  const { data, error } = await supabase.rpc("create_call_room_secure", {
    p_title: title,
    p_max_participants: maxParticipants,
    p_room_mode: roomMode,
    p_password: password,
  });

  if (error || !data) return callErrorResponse(error?.message, "ROOM_CREATE_FAILED");
  return NextResponse.json({ room: data }, { status: 201 });
}

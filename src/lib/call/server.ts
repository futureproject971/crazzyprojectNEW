import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getCallContext() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export function callErrorStatus(message?: string | null) {
  const value = String(message || "");
  if (value.includes("UNAUTHENTICATED")) return 401;
  if (value.includes("ACCOUNT_BANNED") || value.includes("FORBIDDEN") || value.includes("PARTICIPANT_KICKED")) return 403;
  if (value.includes("ROOM_NOT_FOUND") || value.includes("PARTICIPANT_NOT_FOUND")) return 404;
  if (
    value.includes("ROOM_ENDED") ||
    value.includes("ROOM_DISABLED") ||
    value.includes("ROOM_LOCKED") ||
    value.includes("ROOM_FULL") ||
    value.includes("ROOM_NOT_ACTIVE")
  ) return 409;
  if (value.includes("RATE_LIMITED")) return 429;
  return 400;
}

export function callErrorResponse(message?: string | null, fallback = "CALL_REQUEST_FAILED") {
  return NextResponse.json(
    { error: message || fallback },
    { status: callErrorStatus(message) }
  );
}

export function unauthenticated() {
  return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
}

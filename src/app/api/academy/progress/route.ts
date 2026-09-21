import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim();
  const lastPosition = Math.max(0, Math.floor(Number(body?.lastPosition || 0)));
  const completed = Boolean(body?.completed);

  if (!slug) {
    return NextResponse.json({ error: "INVALID_TUTORIAL" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("save_academy_progress", {
    p_slug: slug,
    p_last_position: lastPosition,
    p_completed: completed,
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("ACCESS_DENIED")) {
      return NextResponse.json({ error: "ACCESS_DENIED" }, { status: 403 });
    }
    if (message.includes("TUTORIAL_NOT_FOUND")) {
      return NextResponse.json({ error: "TUTORIAL_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ error: "PROGRESS_SAVE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ progress: data });
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function getAdminContext() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, isAdmin: false };

  const { data: isAdmin, error } = await supabase.rpc("is_current_admin");
  return {
    supabase,
    user,
    isAdmin: !error && isAdmin === true,
  };
}

export async function GET() {
  const { supabase, user, isAdmin } = await getAdminContext();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("get_control_center");

  if (error || !data) {
    return NextResponse.json(
      { error: "CONTROL_CENTER_UNAVAILABLE" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { snapshot: data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await getAdminContext();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "");

  if (action === "set_alert_state") {
    const alertId = String(body?.alertId || "");
    const state = String(body?.state || "");

    if (!alertId || !["open", "acknowledged", "resolved"].includes(state)) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("set_control_center_alert_state", {
      p_alert_id: alertId,
      p_state: state,
    });

    if (error) {
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ alert: data });
  }

  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}

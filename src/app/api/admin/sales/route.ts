import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

async function context() {
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

function guard(user: unknown, isAdmin: boolean) {
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return null;
}

export async function GET(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const denied = guard(user, isAdmin);
  if (denied) return denied;

  const paymentId = clean(request.nextUrl.searchParams.get("paymentId"), 36);

  if (paymentId) {
    if (!UUID_RE.test(paymentId)) {
      return NextResponse.json({ error: "INVALID_PAYMENT" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("get_sales_manager_detail", {
      p_payment_id: paymentId,
    });

    if (error || !data) {
      const message = String(error?.message || "");
      return NextResponse.json(
        { error: message.includes("SALE_NOT_FOUND") ? "SALE_NOT_FOUND" : "SALE_DETAIL_UNAVAILABLE" },
        { status: message.includes("SALE_NOT_FOUND") ? 404 : 500 }
      );
    }

    return NextResponse.json(
      { sale: data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const query = clean(request.nextUrl.searchParams.get("q"), 160);
  const status = clean(request.nextUrl.searchParams.get("status"), 30).toUpperCase();
  const allowedStatuses = new Set([
    "",
    "CREATING",
    "ACTIVE",
    "FULFILLING",
    "COMPLETED",
    "EXPIRED",
    "FAILED",
    "CANCELLED",
  ]);

  if (!allowedStatuses.has(status)) {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || 100);
  const rawOffset = Number(request.nextUrl.searchParams.get("offset") || 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(200, Math.trunc(rawLimit)))
    : 100;
  const offset = Number.isFinite(rawOffset)
    ? Math.max(0, Math.trunc(rawOffset))
    : 0;

  const { data, error } = await supabase.rpc("get_sales_manager", {
    p_query: query || null,
    p_status: status || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error || !data) {
    return NextResponse.json({ error: "SALES_MANAGER_UNAVAILABLE" }, { status: 500 });
  }

  return NextResponse.json(
    { result: data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

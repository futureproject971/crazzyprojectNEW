import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value: unknown, max = 1000) {
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

function denied(user: unknown, isAdmin: boolean) {
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return null;
}

function parseIso(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function cents(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : NaN;
}

export async function GET(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const guard = denied(user, isAdmin);
  if (guard) return guard;

  const fromRaw = request.nextUrl.searchParams.get("from");
  const toRaw = request.nextUrl.searchParams.get("to");
  const from = fromRaw ? parseIso(fromRaw) : null;
  const to = toRaw ? parseIso(toRaw) : null;
  const method = clean(request.nextUrl.searchParams.get("method"), 20).toLowerCase();

  if ((fromRaw && !from) || (toRaw && !to)) {
    return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
  }

  if (method && !["pix", "card", "crypto"].includes(method)) {
    return NextResponse.json({ error: "INVALID_METHOD" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_finance_manager", {
    p_from: from,
    p_to: to,
    p_method: method || null,
  });

  if (error || !data) {
    return NextResponse.json({ error: "FINANCE_MANAGER_UNAVAILABLE" }, { status: 500 });
  }

  return NextResponse.json(
    { finance: data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const guard = denied(user, isAdmin);
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  const action = clean(body?.action, 50);

  if (action === "set_fee_rule") {
    const method = clean(body?.method, 20).toLowerCase();
    const percent = Number(body?.percent);
    const fixedCents = cents(body?.fixedCents);

    if (
      !["pix", "card", "crypto"].includes(method) ||
      !Number.isFinite(percent) ||
      percent < 0 ||
      percent > 100 ||
      !Number.isFinite(fixedCents) ||
      fixedCents < 0
    ) {
      return NextResponse.json({ error: "INVALID_FEE_RULE" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("set_finance_fee_rule", {
      p_method: method,
      p_percent_bps: Math.round(percent * 100),
      p_fixed_cents: fixedCents,
      p_source_label: clean(body?.sourceLabel, 120) || null,
      p_notes: clean(body?.notes, 1000) || null,
    });

    if (error || !data) {
      return NextResponse.json({ error: "FEE_RULE_SAVE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ rule: data }, { status: 201 });
  }

  if (action === "clear_fee_rule") {
    const method = clean(body?.method, 20).toLowerCase();
    if (!["pix", "card", "crypto"].includes(method)) {
      return NextResponse.json({ error: "INVALID_METHOD" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("clear_finance_fee_rule", {
      p_method: method,
    });

    if (error || data !== true) {
      return NextResponse.json({ error: "FEE_RULE_CLEAR_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "set_payment_cost") {
    const paymentId = clean(body?.paymentId, 36);
    const gatewayFeeCents = cents(body?.gatewayFeeCents);
    const providerNetRaw = body?.providerNetCents;
    const providerNetCents =
      providerNetRaw === null || providerNetRaw === undefined || providerNetRaw === ""
        ? null
        : cents(providerNetRaw);

    if (
      !UUID_RE.test(paymentId) ||
      !Number.isFinite(gatewayFeeCents) ||
      gatewayFeeCents < 0 ||
      (providerNetCents !== null &&
        (!Number.isFinite(providerNetCents) || providerNetCents < 0))
    ) {
      return NextResponse.json({ error: "INVALID_PAYMENT_COST" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("set_payment_finance_cost", {
      p_payment_id: paymentId,
      p_gateway_fee_cents: gatewayFeeCents,
      p_provider_net_cents: providerNetCents,
      p_source: "manual",
      p_note: clean(body?.note, 1000) || null,
    });

    if (error || !data) {
      return NextResponse.json({ error: "PAYMENT_COST_SAVE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ cost: data });
  }

  if (action === "create_hold") {
    const amountCents = cents(body?.amountCents);
    const paymentId = clean(body?.paymentId, 36);

    if (
      !Number.isFinite(amountCents) ||
      amountCents <= 0 ||
      (paymentId && !UUID_RE.test(paymentId))
    ) {
      return NextResponse.json({ error: "INVALID_HOLD" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("create_finance_hold", {
      p_amount_cents: amountCents,
      p_reason: clean(body?.reason, 1000) || null,
      p_payment_id: paymentId || null,
      p_provider_ref: clean(body?.providerRef, 200) || null,
    });

    if (error || !data) {
      return NextResponse.json({ error: "HOLD_CREATE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ hold: data }, { status: 201 });
  }

  if (action === "set_hold_status") {
    const holdId = clean(body?.holdId, 36);
    const status = clean(body?.status, 20).toLowerCase();

    if (!UUID_RE.test(holdId) || !["released", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "INVALID_HOLD_STATUS" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("set_finance_hold_status", {
      p_hold_id: holdId,
      p_status: status,
    });

    if (error || data !== true) {
      return NextResponse.json({ error: "HOLD_UPDATE_FAILED" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}

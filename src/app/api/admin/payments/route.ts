import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getVerifiedAccessToken,
} from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/supabase/config";

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

  return { supabase, user, isAdmin: !error && isAdmin === true };
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

    const { data, error } = await supabase.rpc("get_payment_manager_detail", {
      p_payment_id: paymentId,
    });

    if (error || !data) {
      const message = String(error?.message || "");
      return NextResponse.json(
        { error: message.includes("PAYMENT_NOT_FOUND") ? "PAYMENT_NOT_FOUND" : "PAYMENT_DETAIL_UNAVAILABLE" },
        { status: message.includes("PAYMENT_NOT_FOUND") ? 404 : 500 }
      );
    }

    return NextResponse.json(
      { payment: data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const query = clean(request.nextUrl.searchParams.get("q"), 160);
  const status = clean(request.nextUrl.searchParams.get("status"), 30).toUpperCase();
  const method = clean(request.nextUrl.searchParams.get("method"), 20).toLowerCase();

  const statuses = new Set([
    "",
    "CREATING",
    "ACTIVE",
    "FULFILLING",
    "COMPLETED",
    "EXPIRED",
    "FAILED",
    "CANCELLED",
  ]);
  const methods = new Set(["", "pix", "card", "crypto"]);

  if (!statuses.has(status) || !methods.has(method)) {
    return NextResponse.json({ error: "INVALID_FILTER" }, { status: 400 });
  }

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || 100);
  const rawOffset = Number(request.nextUrl.searchParams.get("offset") || 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(200, Math.trunc(rawLimit)))
    : 100;
  const offset = Number.isFinite(rawOffset)
    ? Math.max(0, Math.trunc(rawOffset))
    : 0;

  const { data, error } = await supabase.rpc("get_payments_manager", {
    p_query: query || null,
    p_status: status || null,
    p_method: method || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error || !data) {
    return NextResponse.json({ error: "PAYMENTS_MANAGER_UNAVAILABLE" }, { status: 500 });
  }

  return NextResponse.json(
    { result: data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const denied = guard(user, isAdmin);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const action = clean(body?.action, 40);

  if (action === "set_method") {
    const method = clean(body?.method, 20).toLowerCase();
    if (!["pix", "card", "crypto"].includes(method)) {
      return NextResponse.json({ error: "INVALID_METHOD" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("set_payment_method_enabled", {
      p_method: method,
      p_enabled: body?.enabled === true,
    });

    if (error || data !== true) {
      return NextResponse.json({ error: "METHOD_UPDATE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const denied = guard(user, isAdmin);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const action = clean(body?.action, 40);
  const paymentId = clean(body?.paymentId, 36);

  if (!UUID_RE.test(paymentId)) {
    return NextResponse.json({ error: "INVALID_PAYMENT" }, { status: 400 });
  }

  if (action === "reconcile") {
    const reason = clean(body?.reason, 500) || "Reconciliação manual pelo Payments Manager";

    const { data: requestRow, error: requestError } = await supabase.rpc(
      "request_payment_reconciliation",
      {
        p_payment_id: paymentId,
        p_reason: reason,
      }
    );

    if (requestError || !requestRow) {
      return NextResponse.json({ error: "RECONCILE_QUEUE_FAILED" }, { status: 400 });
    }

    const token = await getVerifiedAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "RECONCILE_AUTH_UNAVAILABLE", request: requestRow },
        { status: 401 }
      );
    }

    const edge = new URL("/functions/v1/purincash-payment", SUPABASE_URL);
    edge.searchParams.set("action", "admin-reconcile");

    const response = await fetch(edge, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payment_id: paymentId }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        {
          error: payload?.error || "RECONCILE_PROVIDER_FAILED",
          request: requestRow,
        },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 }
      );
    }

    return NextResponse.json({ request: requestRow, reconciliation: payload });
  }

  if (action === "register_refund_case") {
    const amountCents = Math.trunc(Number(body?.amountCents));
    const reason = clean(body?.reason, 1000);

    const { data: payment } = await supabase
      .from("payments")
      .select("id,amount,status")
      .eq("id", paymentId)
      .maybeSingle();

    if (
      !payment ||
      payment.status !== "COMPLETED" ||
      !Number.isFinite(amountCents) ||
      amountCents <= 0 ||
      amountCents > Number(payment.amount)
    ) {
      return NextResponse.json({ error: "INVALID_REFUND_CASE" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("payment_refunds")
      .insert({
        payment_id: paymentId,
        requested_by: user!.id,
        amount_cents: amountCents,
        reason: reason || null,
        status: "requested",
      })
      .select("id,status")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "REFUND_CASE_FAILED" }, { status: 400 });
    }

    return NextResponse.json(
      {
        refund: data,
        providerActionExecuted: false,
        note: "Caso registrado. Nenhum reembolso foi enviado ao gateway.",
      },
      { status: 201 }
    );
  }

  if (action === "register_dispute") {
    const reason = clean(body?.reason, 1000);
    const providerRef = clean(body?.providerRef, 200) || null;
    const amountCentsRaw = Number(body?.amountCents);
    const amountCents =
      Number.isFinite(amountCentsRaw) && amountCentsRaw >= 0
        ? Math.trunc(amountCentsRaw)
        : null;

    const { data, error } = await supabase
      .from("payment_disputes")
      .insert({
        payment_id: paymentId,
        provider_ref: providerRef,
        status: "open",
        reason: reason || null,
        amount_cents: amountCents,
      })
      .select("id,status")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "DISPUTE_CREATE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ dispute: data }, { status: 201 });
  }

  if (action === "add_evidence") {
    const disputeId = clean(body?.disputeId, 36);
    const note = clean(body?.note, 4000);
    if (!UUID_RE.test(disputeId) || !note) {
      return NextResponse.json({ error: "INVALID_EVIDENCE" }, { status: 400 });
    }

    const { data: dispute } = await supabase
      .from("payment_disputes")
      .select("id,payment_id")
      .eq("id", disputeId)
      .eq("payment_id", paymentId)
      .maybeSingle();

    if (!dispute) {
      return NextResponse.json({ error: "DISPUTE_NOT_FOUND" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("payment_dispute_evidence")
      .insert({
        dispute_id: disputeId,
        created_by: user!.id,
        evidence_type: "note",
        note,
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "EVIDENCE_CREATE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ evidence: data }, { status: 201 });
  }

  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}

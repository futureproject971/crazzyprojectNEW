import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { attachCheckoutProof, calculateServerTotal, fulfillOrder, verifyCheckoutProof } from "../_shared/checkout.ts";

const PURINCASH_BASE_URL = "https://api.purincash.com/v1";
const JSON_HEADERS = { "Content-Type": "application/json" };
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type InternalStatus = "ACTIVE" | "FULFILLING" | "COMPLETED" | "EXPIRED" | "FAILED" | "CANCELLED";
type ProviderKind = "charge" | "payment" | "card";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...JSON_HEADERS },
  });
}

function getSupabaseSecretKey() {
  const keysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keysJson) {
    try {
      const keys = JSON.parse(keysJson);
      if (keys?.default) return String(keys.default);
    } catch (error) {
      console.warn("[purincash] SUPABASE_SECRET_KEYS is not valid JSON", error);
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function getSupabasePublishableKey() {
  const keysJson = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (keysJson) {
    try {
      const keys = JSON.parse(keysJson);
      if (keys?.default) return String(keys.default);
    } catch (error) {
      console.warn("[purincash] SUPABASE_PUBLISHABLE_KEYS is not valid JSON", error);
    }
  }
  return Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
}

function normalizeProviderStatus(raw: unknown): InternalStatus {
  const status = String(raw || "").trim().toLowerCase();
  if (status === "paid" || status === "completed") return "COMPLETED";
  if (status === "expired") return "EXPIRED";
  if (status === "failed") return "FAILED";
  if (status === "refunded" || status === "cancelled" || status === "canceled") return "CANCELLED";
  return "ACTIVE";
}

function providerAmountCents(payload: any, kind: ProviderKind): number | null {
  const cents = Number(payload?.amountCents ?? payload?.valueCents);
  if (Number.isFinite(cents) && cents >= 0) return Math.round(cents);

  // Card webhooks/legacy responses can expose amount in BRL decimal.
  if (kind === "card") {
    const amount = Number(payload?.amount);
    if (Number.isFinite(amount) && amount >= 0) return Math.round(amount * 100);
  }
  return null;
}

function inferProviderKind(providerId: string, event?: string): ProviderKind {
  if (event === "card_payment.paid") return "card";
  if (event === "charge.paid") return "charge";
  if (event === "payment.paid") return "payment";
  if (providerId.startsWith("psc_") || providerId.startsWith("psplit_")) return "charge";
  if (providerId.startsWith("psa_")) return "payment";
  return "card";
}

function orderIdFromMetadata(payload: any): string {
  const raw = payload?.metadata;
  if (!raw) return "";
  let metadata: any = raw;
  if (typeof raw === "string") {
    try { metadata = JSON.parse(raw); } catch { return ""; }
  }
  const orderId = String(metadata?.orderId || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId) ? orderId : "";
}

async function purincashRequest(apiKey: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${PURINCASH_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? JSON_HEADERS : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function fetchProviderPayment(apiKey: string, providerId: string, kind: ProviderKind) {
  const path = kind === "charge"
    ? `/charges/${encodeURIComponent(providerId)}`
    : kind === "payment"
      ? `/payments/${encodeURIComponent(providerId)}`
      : `/card-payments/${encodeURIComponent(providerId)}`;
  return purincashRequest(apiKey, path);
}

async function hmacHex(secret: string, rawBody: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody)));
  return Array.from(signature).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqualHex(left: string, right: string) {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function claimAndFulfill(
  supabaseAdmin: any,
  payment: any,
  providerPayload: any,
  providerKind: ProviderKind,
  checkoutSigningSecret: string,
) {
  // The signed checkout is immutable and bound to this exact internal payment ID,
  // provider transaction, user, total and cart. Never rebuild paid orders from
  // mutable catalog/coupon data because prices can legitimately change after checkout.
  const proof = await verifyCheckoutProof(checkoutSigningSecret, payment);
  if (!proof.valid) {
    console.error("[purincash] invalid or missing checkout proof", payment.id);
    return { ok: false, status: 409, error: "Integridade do pedido não confere" };
  }

  const expectedTotal = Math.round(Number(payment.amount));
  if (!Number.isFinite(expectedTotal) || expectedTotal <= 0) {
    return { ok: false, status: 409, error: "Valor interno do pedido inválido" };
  }

  const providerAmount = providerAmountCents(providerPayload, providerKind);
  if (providerAmount === null || providerAmount !== expectedTotal) {
    console.error("[purincash] provider amount mismatch", { providerAmount, expected: expectedTotal, id: payment.id });
    return { ok: false, status: 409, error: "Valor pago não confere com o pedido" };
  }

  // Recover a worker lease only after it is clearly stale. Individual delivery units are
  // idempotent in claim_paid_delivery(), so a retry after a crash is safe, while the
  // five-minute lease prevents two live workers from fulfilling the same payment.
  if (payment.status === "FULFILLING" && payment.updated_at) {
    const updatedAt = new Date(payment.updated_at).getTime();
    const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
    if (Number.isFinite(updatedAt) && updatedAt < Date.now() - 5 * 60_000) {
      const { data: recovered } = await supabaseAdmin
        .from("payments")
        .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
        .eq("id", payment.id)
        .eq("status", "FULFILLING")
        .lt("updated_at", staleBefore)
        .select("id")
        .maybeSingle();
      if (recovered) payment = { ...payment, status: "ACTIVE", updated_at: new Date().toISOString() };
    }
  }

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("payments")
    .update({ status: "FULFILLING", updated_at: new Date().toISOString() })
    .eq("id", payment.id)
    .in("status", ["ACTIVE", "EXPIRED"])
    .select("id")
    .maybeSingle();

  if (claimError) {
    console.error("[purincash] claim error", claimError);
    return { ok: false, status: 500, error: "Falha ao reservar processamento do pedido" };
  }

  if (!claimed) {
    const { data: current } = await supabaseAdmin
      .from("payments")
      .select("status")
      .eq("id", payment.id)
      .maybeSingle();
    if (current?.status === "COMPLETED" || current?.status === "FULFILLING") {
      return { ok: true, alreadyClaimed: true };
    }
    return { ok: false, status: 409, error: "Pagamento não está disponível para entrega" };
  }

  try {
    await fulfillOrder(supabaseAdmin, {
      ...payment,
      cart_snapshot: proof.cartSnapshot,
    });

    const { data: completedPayment, error: completeError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "COMPLETED",
        paid_at: providerPayload?.paidAt || new Date().toISOString(),
        cart_snapshot: payment.cart_snapshot,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .eq("status", "FULFILLING")
      .select("id,status")
      .maybeSingle();

    if (completeError || !completedPayment) {
      console.error("[purincash] payment completion write failed", payment.id, completeError);
      await supabaseAdmin
        .from("payments")
        .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
        .eq("id", payment.id)
        .eq("status", "FULFILLING");
      return { ok: false, status: 500, error: "Entrega concluída, mas o pagamento precisa ser conciliado novamente" };
    }

    return { ok: true, alreadyClaimed: false };
  } catch (error) {
    console.error("[purincash] fulfillment failed", error);
    await supabaseAdmin
      .from("payments")
      .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("status", "FULFILLING");
    return { ok: false, status: 500, error: "Pagamento confirmado, mas a entrega precisa ser reprocessada" };
  }
}

function withPaymentMethod(cart: any[], method: "pix" | "card" | "crypto") {
  return cart.map((item, index) => index === 0 ? { ...item, paymentMethod: method } : item);
}

async function paymentMethodEnabled(supabaseAdmin: any, method: "pix" | "card" | "crypto") {
  const { data, error } = await supabaseAdmin
    .from("payment_settings")
    .select("enabled")
    .eq("method", method)
    .maybeSingle();

  if (error) {
    console.warn("[purincash] payment method settings unavailable", { method, error: error.message });
    return false;
  }
  return data?.enabled === true;
}

async function checkoutRateLimited(supabaseAdmin: any, userId: string) {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    console.warn("[purincash] checkout rate-limit lookup failed", error);
    return false; // do not lock real customers out because a telemetry query failed
  }
  return Number(count || 0) >= 8;
}


function normalizeIdempotencyKey(raw: unknown) {
  const value = String(raw || "").trim();
  if (!value) return "legacy:" + crypto.randomUUID();
  if (!/^[A-Za-z0-9:_-]{12,120}$/.test(value)) return "";
  return value;
}

async function reserveCheckoutAttempt(
  supabaseAdmin: any,
  args: {
    id: string;
    userId: string;
    idempotencyKey: string;
    method: "pix" | "card" | "crypto";
    checkout: any;
  },
) {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .insert({
      id: args.id,
      user_id: args.userId,
      amount: args.checkout.total,
      status: "CREATING",
      cart_snapshot: args.checkout.cartSnapshot,
      coupon_id: args.checkout.couponId,
      discount_amount: args.checkout.discountAmount / 100,
      idempotency_key: args.idempotencyKey,
      payment_method: args.method,
    })
    .select("id,status,charge_id,checkout_payload,payment_method,expires_at")
    .single();

  if (!error) return { created: true, payment: data };

  if (String(error.code || "") === "23505") {
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id,status,charge_id,checkout_payload,payment_method,expires_at")
      .eq("user_id", args.userId)
      .eq("idempotency_key", args.idempotencyKey)
      .maybeSingle();
    if (existing) return { created: false, payment: existing };
  }

  console.error("[purincash] checkout reservation failed", error);
  return { created: false, error: "Não foi possível reservar a tentativa de checkout" };
}

function replayCheckout(payment: any) {
  if (payment?.checkout_payload && typeof payment.checkout_payload === "object") {
    return json({ ...payment.checkout_payload, replayed: true }, 200);
  }
  if (payment?.status === "CREATING") {
    return json({ success: false, pending: true, payment_id: payment.id, status: "CREATING" }, 202);
  }
  return json({ error: "Esta tentativa de checkout já foi usada. Inicie uma nova tentativa." }, 409);
}

async function failCheckoutAttempt(supabaseAdmin: any, paymentId: string) {
  await supabaseAdmin
    .from("payments")
    .update({ status: "FAILED", updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "CREATING");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SECRET_KEY = getSupabaseSecretKey();
  const SUPABASE_PUBLISHABLE_KEY = getSupabasePublishableKey();
  const PURINCASH_API_KEY = Deno.env.get("PURINCASH_API_KEY") || "";
  // Prefer a dedicated signing key. Webhook secret fallback keeps deployments
  // compatible while still keeping the proof server-only.
  const CHECKOUT_SIGNING_SECRET = Deno.env.get("CHECKOUT_SIGNING_SECRET") || Deno.env.get("PURINCASH_WEBHOOK_SECRET") || "";

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return json({ error: "Supabase backend secrets not configured" }, 500);
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  if (action === "config" && req.method === "GET") {
    const { data: methods } = await supabaseAdmin
      .from("payment_settings")
      .select("method, label, enabled")
      .in("method", ["pix", "card", "crypto"]);
    return json({
      ready: Boolean(PURINCASH_API_KEY && CHECKOUT_SIGNING_SECRET && Deno.env.get("PURINCASH_WEBHOOK_SECRET")),
      methods: methods || [],
      cardGate: Deno.env.get("ENABLE_CARD_CHECKOUT") === "true",
    });
  }

  // Public endpoint by necessity. Authenticity comes from PurinCash HMAC over the raw body.
  if (action === "webhook" && req.method === "POST") {
    const webhookSecret = Deno.env.get("PURINCASH_WEBHOOK_SECRET") || "";
    const signature = req.headers.get("X-Webhook-Signature") || "";
    const webhookId = req.headers.get("X-Webhook-Id") || "";
    const rawBody = await req.text();

    if (!webhookSecret || !signature) return json({ error: "Webhook signature missing" }, 401);
    const expectedSignature = await hmacHex(webhookSecret, rawBody);
    if (!constantTimeEqualHex(signature, expectedSignature)) {
      console.warn("[purincash] rejected webhook signature", webhookId);
      return json({ error: "Invalid webhook signature" }, 401);
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const eventName = String(event?.event || "");
    if (!["charge.paid", "payment.paid", "card_payment.paid"].includes(eventName) || String(event?.status || "").toLowerCase() !== "paid") {
      return json({ ok: true, ignored: true });
    }

    const providerId = String(event?.paymentId || event?.orderCode || "");
    if (!providerId) return json({ error: "Provider payment ID missing" }, 400);
    if (!PURINCASH_API_KEY) return json({ error: "PURINCASH_API_KEY not configured" }, 500);
    if (!CHECKOUT_SIGNING_SECRET) return json({ error: "Checkout signing secret not configured" }, 500);

    const providerKind = inferProviderKind(providerId, eventName);
    const { response: verifyResponse, body: providerData } = await fetchProviderPayment(PURINCASH_API_KEY, providerId, providerKind);
    if (!verifyResponse.ok || normalizeProviderStatus(providerData?.status) !== "COMPLETED") {
      console.warn("[purincash] webhook received but provider reconciliation is not paid", providerId, verifyResponse.status, providerData?.status);
      return json({ ok: true, pendingReconciliation: true });
    }

    // New payments carry our internal UUID in provider metadata. This lets the webhook
    // select the exact row instead of trusting a client-writable charge_id lookup.
    const internalOrderId = orderIdFromMetadata(event) || orderIdFromMetadata(providerData);
    if (!internalOrderId) {
      console.error("[purincash] paid event missing signed order metadata", providerId, webhookId);
      return json({ error: "Order metadata missing" }, 409);
    }

    const { data: payment, error: lookupError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", internalOrderId)
      .eq("charge_id", providerId)
      .maybeSingle();

    if (lookupError || !payment) return json({ ok: true, notFound: true });
    const proof = await verifyCheckoutProof(CHECKOUT_SIGNING_SECRET, payment);
    if (!proof.valid) {
      console.error("[purincash] provider metadata resolved to an unsigned/tampered order", internalOrderId, providerId);
      return json({ error: "Order integrity check failed" }, 409);
    }
    if (payment.status === "COMPLETED") return json({ ok: true, duplicate: true });

    const fulfillment = await claimAndFulfill(supabaseAdmin, payment, providerData, providerKind, CHECKOUT_SIGNING_SECRET);
    if (!fulfillment.ok) return json({ error: fulfillment.error }, fulfillment.status || 409);
    return json({ ok: true, duplicate: fulfillment.alreadyClaimed === true });
  }

  // All customer actions below require a real authenticated Supabase user.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ") || !SUPABASE_PUBLISHABLE_KEY) return json({ error: "Unauthorized" }, 401);
  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  if (!CHECKOUT_SIGNING_SECRET && ["create", "create-card", "create-crypto", "status", "card-status", "crypto-status", "quote"].includes(action)) {
    return json({ error: "Checkout signing secret not configured" }, 500);
  }

  const getCheckout = async (body: any) => {
    const rawCart = Array.isArray(body?.cart_snapshot) ? body.cart_snapshot : [];
    let couponId = body?.coupon_id || null;
    const couponCode = String(body?.coupon_code || "").trim().toUpperCase();
    if (!couponId && couponCode) {
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("id")
        .eq("code", couponCode)
        .eq("active", true)
        .maybeSingle();
      couponId = coupon?.id || null;
      if (!couponId) return { error: "Cupom inválido ou inativo" };
    }
    return calculateServerTotal(supabaseAdmin, rawCart, couponId, userId);
  };

  if (action === "quote" && req.method === "POST") {
    const body = await req.json();
    const checkout = await getCheckout(body);
    if (checkout.error) return json({ error: checkout.error }, 400);
    return json({
      success: true,
      subtotalCents: checkout.subtotal,
      comboDiscountCents: checkout.comboDiscountAmount || 0,
      couponDiscountCents: checkout.couponDiscountAmount || 0,
      discountCents: checkout.discountAmount,
      discountSource: checkout.discountSource || "none",
      totalCents: checkout.total,
      couponId: checkout.couponId,
      items: checkout.cartSnapshot.map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        planId: item.planId,
        planName: item.planName,
        planCode: item.planCode || null,
        quantity: item.quantity,
        price: item.price,
      })),
    });
  }

  if (!PURINCASH_API_KEY) return json({ error: "PURINCASH_API_KEY not configured" }, 500);

  const getCustomer = async () => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      name: String(profile?.username || userData.user.email?.split("@")[0] || "Cliente").slice(0, 100),
      email: String(userData.user.email || "").slice(0, 255),
      externalId: userId,
    };
  };

  const callbackUrl = `${SUPABASE_URL}/functions/v1/purincash-payment?action=webhook`;

  if (action === "create" && req.method === "POST") {
    if (!await paymentMethodEnabled(supabaseAdmin, "pix")) {
      return json({ error: "Pagamento PIX está temporariamente indisponível" }, 503);
    }
    const body = await req.json();
    const idempotencyKey = normalizeIdempotencyKey(body?.idempotency_key);
    if (!idempotencyKey) return json({ error: "Idempotency key inválida" }, 400);
    const internalPaymentId = crypto.randomUUID();

    if (await checkoutRateLimited(supabaseAdmin, userId)) {
      return json({ error: "Muitas tentativas de checkout. Aguarde alguns minutos e tente novamente." }, 429);
    }
    const checkout = await getCheckout(body);
    if (checkout.error) return json({ error: checkout.error }, 400);
    if (checkout.total < 80) return json({ error: "Valor abaixo do mínimo permitido pelo gateway" }, 400);

    const reservation = await reserveCheckoutAttempt(supabaseAdmin, {
      id: internalPaymentId,
      userId,
      idempotencyKey,
      method: "pix",
      checkout,
    });
    if (reservation.error) return json({ error: reservation.error }, 500);
    if (!reservation.created) return replayCheckout(reservation.payment);

    const customer = await getCustomer();
    const { response, body: provider } = await purincashRequest(PURINCASH_API_KEY, "/charges", {
      method: "POST",
      body: JSON.stringify({
        valueCents: checkout.total,
        description: String(body?.description || "Compra CRAZZY PROJECT").slice(0, 200),
        expiresIn: 1800,
        callbackUrl,
        customer,
        metadata: JSON.stringify({ source: "crazzy-project", orderId: internalPaymentId, userId }),
      }),
    });
    if (!response.ok || !provider?.paymentId) {
      await failCheckoutAttempt(supabaseAdmin, internalPaymentId);
      return json({ error: provider?.error || "Erro ao criar cobrança PIX" }, response.status || 502);
    }

    const persistedCart = await attachCheckoutProof(CHECKOUT_SIGNING_SECRET, {
      paymentId: internalPaymentId,
      chargeId: provider.paymentId,
      userId,
      totalCents: checkout.total,
      couponId: checkout.couponId,
      discountCents: checkout.discountAmount,
      cartSnapshot: withPaymentMethod(checkout.cartSnapshot, "pix"),
    });

    const payload = {
      success: true,
      payment_id: internalPaymentId,
      charge: {
        id: provider.paymentId,
        brCode: provider?.pix?.brCode || "",
        qrCodeImage: provider?.pix?.qrCodeImage || "",
        expiresAt: provider?.expiresAt || null,
      },
      authoritativeSubtotalCents: checkout.subtotal,
      authoritativeDiscountCents: checkout.discountAmount,
      authoritativeTotalCents: checkout.total,
      discountSource: checkout.discountSource || "none",
    };

    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        charge_id: provider.paymentId,
        status: "ACTIVE",
        cart_snapshot: persistedCart,
        expires_at: provider?.expiresAt || null,
        checkout_payload: payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", internalPaymentId)
      .eq("status", "CREATING");
    if (updateError) {
      console.error("[purincash] PIX reservation finalization failed", internalPaymentId, provider.paymentId, updateError);
      return json({ error: "Cobrança criada, mas precisa de conciliação. Contate o suporte." }, 500);
    }

    return json(payload, 201);
  }

  if (action === "create-card" && req.method === "POST") {
    if (!await paymentMethodEnabled(supabaseAdmin, "card")) {
      return json({ error: "Pagamento por cartão está temporariamente indisponível" }, 503);
    }
    if (Deno.env.get("ENABLE_CARD_CHECKOUT") !== "true") {
      return json({ error: "Pagamento por cartão está temporariamente desativado" }, 403);
    }
    if (PURINCASH_API_KEY.startsWith("ps_test_")) return json({ error: "Cartão não está disponível no sandbox da PurinCash" }, 400);

    const body = await req.json();
    const idempotencyKey = normalizeIdempotencyKey(body?.idempotency_key);
    if (!idempotencyKey) return json({ error: "Idempotency key inválida" }, 400);
    const internalPaymentId = crypto.randomUUID();

    if (await checkoutRateLimited(supabaseAdmin, userId)) {
      return json({ error: "Muitas tentativas de checkout. Aguarde alguns minutos e tente novamente." }, 429);
    }
    const checkout = await getCheckout(body);
    if (checkout.error) return json({ error: checkout.error }, 400);
    if (checkout.total < 100) return json({ error: "Valor abaixo do mínimo permitido" }, 400);

    const reservation = await reserveCheckoutAttempt(supabaseAdmin, {
      id: internalPaymentId,
      userId,
      idempotencyKey,
      method: "card",
      checkout,
    });
    if (reservation.error) return json({ error: reservation.error }, 500);
    if (!reservation.created) return replayCheckout(reservation.payment);

    const customer = await getCustomer();
    const siteUrl = (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "").replace(/\/$/, "");
    const requestBody: Record<string, unknown> = {
      valueCents: checkout.total,
      description: String(body?.description || "Compra CRAZZY PROJECT").slice(0, 200),
      callbackUrl,
      customer,
      metadata: JSON.stringify({ source: "crazzy-project", orderId: internalPaymentId, userId }),
    };
    if (siteUrl) {
      requestBody.successUrl = siteUrl + "/checkout?status=success";
      requestBody.cancelUrl = siteUrl + "/carrinho";
    }

    const { response, body: provider } = await purincashRequest(PURINCASH_API_KEY, "/card-payments", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    if (!response.ok || !provider?.orderCode || !provider?.checkoutUrl) {
      await failCheckoutAttempt(supabaseAdmin, internalPaymentId);
      return json({ error: provider?.error || "Erro ao criar pagamento por cartão" }, response.status || 502);
    }

    const persistedCart = await attachCheckoutProof(CHECKOUT_SIGNING_SECRET, {
      paymentId: internalPaymentId,
      chargeId: provider.orderCode,
      userId,
      totalCents: checkout.total,
      couponId: checkout.couponId,
      discountCents: checkout.discountAmount,
      cartSnapshot: withPaymentMethod(checkout.cartSnapshot, "card"),
    });

    const payload = {
      success: true,
      payment_id: internalPaymentId,
      paymentUrl: provider.checkoutUrl,
      charge_id: provider.orderCode,
      expiresAt: provider.expiresAt || null,
      authoritativeSubtotalCents: checkout.subtotal,
      authoritativeDiscountCents: checkout.discountAmount,
      authoritativeTotalCents: checkout.total,
      discountSource: checkout.discountSource || "none",
    };

    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        charge_id: provider.orderCode,
        status: "ACTIVE",
        cart_snapshot: persistedCart,
        expires_at: provider.expiresAt || null,
        checkout_payload: payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", internalPaymentId)
      .eq("status", "CREATING");
    if (updateError) return json({ error: "Pagamento criado, mas precisa de conciliação. Contate o suporte." }, 500);

    return json(payload, 201);
  }

  if (action === "create-crypto" && req.method === "POST") {
    if (!await paymentMethodEnabled(supabaseAdmin, "crypto")) {
      return json({ error: "Pagamento em Litecoin está temporariamente indisponível" }, 503);
    }
    if (PURINCASH_API_KEY.startsWith("ps_test_")) return json({ error: "Litecoin não está disponível no sandbox da PurinCash" }, 400);

    const body = await req.json();
    const idempotencyKey = normalizeIdempotencyKey(body?.idempotency_key);
    if (!idempotencyKey) return json({ error: "Idempotency key inválida" }, 400);
    const internalPaymentId = crypto.randomUUID();

    if (await checkoutRateLimited(supabaseAdmin, userId)) {
      return json({ error: "Muitas tentativas de checkout. Aguarde alguns minutos e tente novamente." }, 429);
    }
    const checkout = await getCheckout(body);
    if (checkout.error) return json({ error: checkout.error }, 400);
    if (checkout.total < 80) return json({ error: "Valor abaixo do mínimo permitido" }, 400);

    const reservation = await reserveCheckoutAttempt(supabaseAdmin, {
      id: internalPaymentId,
      userId,
      idempotencyKey,
      method: "crypto",
      checkout,
    });
    if (reservation.error) return json({ error: reservation.error }, 500);
    if (!reservation.created) return replayCheckout(reservation.payment);

    const customer = await getCustomer();
    const { response, body: provider } = await purincashRequest(PURINCASH_API_KEY, "/payments", {
      method: "POST",
      body: JSON.stringify({
        paymentMethod: "ltc",
        valueCents: checkout.total,
        description: String(body?.description || "Compra CRAZZY PROJECT").slice(0, 200),
        callbackUrl,
        customer,
        metadata: JSON.stringify({ source: "crazzy-project", orderId: internalPaymentId, userId }),
      }),
    });
    if (!response.ok || !provider?.paymentId || !provider?.ltc?.address) {
      await failCheckoutAttempt(supabaseAdmin, internalPaymentId);
      return json({ error: provider?.error || "Erro ao criar pagamento em Litecoin" }, response.status || 502);
    }

    const persistedCart = await attachCheckoutProof(CHECKOUT_SIGNING_SECRET, {
      paymentId: internalPaymentId,
      chargeId: provider.paymentId,
      userId,
      totalCents: checkout.total,
      couponId: checkout.couponId,
      discountCents: checkout.discountAmount,
      cartSnapshot: withPaymentMethod(checkout.cartSnapshot, "crypto"),
    });

    const payload = {
      success: true,
      payment_id: internalPaymentId,
      crypto: {
        address: provider.ltc.address,
        qrCode: "",
        payAmount: String(provider.ltc.amount),
        payCurrency: "LTC",
        network: "Litecoin",
        expiresAt: provider.expiresAt || null,
      },
      charge_id: provider.paymentId,
      authoritativeSubtotalCents: checkout.subtotal,
      authoritativeDiscountCents: checkout.discountAmount,
      authoritativeTotalCents: checkout.total,
      discountSource: checkout.discountSource || "none",
    };

    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        charge_id: provider.paymentId,
        status: "ACTIVE",
        cart_snapshot: persistedCart,
        expires_at: provider.expiresAt || null,
        checkout_payload: payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", internalPaymentId)
      .eq("status", "CREATING");
    if (updateError) return json({ error: "Pagamento criado, mas precisa de conciliação. Contate o suporte." }, 500);

    return json(payload, 201);
  }

  if (["status", "card-status", "crypto-status"].includes(action) && req.method === "GET") {
    const paymentId = url.searchParams.get("payment_id") || "";
    if (!paymentId) return json({ error: "payment_id required" }, 400);

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!payment) return json({ error: "Pagamento não encontrado" }, 404);
    if (payment.status === "COMPLETED") return json({ success: true, status: "COMPLETED" });
    if (payment.status === "CREATING") return json({ success: true, status: "CREATING" });
    if (payment.status === "FAILED") return json({ success: true, status: "FAILED" });
    if (payment.status === "FULFILLING") {
      const updatedAt = new Date(payment.updated_at || 0).getTime();
      const leaseIsFresh = Number.isFinite(updatedAt) && updatedAt >= Date.now() - 5 * 60_000;
      if (leaseIsFresh) return json({ success: true, status: "ACTIVE" });
      // A stale worker lease must fall through to provider reconciliation so
      // claimAndFulfill() can safely reset/reclaim it using idempotent delivery units.
    }

    const providerKind: ProviderKind = action === "card-status" ? "card" : action === "crypto-status" ? "payment" : "charge";
    const { response, body: provider } = await fetchProviderPayment(PURINCASH_API_KEY, payment.charge_id, providerKind);
    if (!response.ok) {
      if (response.status === 404) return json({ error: "Cobrança não encontrada no gateway" }, 404);
      return json({ success: true, status: payment.status, gatewayUnavailable: true });
    }

    const newStatus = normalizeProviderStatus(provider?.status);
    if (newStatus === "COMPLETED") {
      const fulfillment = await claimAndFulfill(supabaseAdmin, payment, provider, providerKind, CHECKOUT_SIGNING_SECRET);
      if (!fulfillment.ok) return json({ error: fulfillment.error, status: "ACTIVE" }, fulfillment.status || 409);
      return json({ success: true, status: "COMPLETED" });
    }

    if (newStatus !== "ACTIVE" && payment.status !== newStatus) {
      await supabaseAdmin
        .from("payments")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", payment.id)
        .eq("user_id", userId);
    }
    return json({ success: true, status: newStatus });
  }

  return json({ error: "Invalid action" }, 400);
});

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

function providerKindFromPayment(payment: any): ProviderKind {
  const method = String(payment?.payment_method || "").toLowerCase();
  if (method === "card") return "card";
  if (method === "crypto") return "payment";
  if (method === "pix") return "charge";
  return inferProviderKind(String(payment?.charge_id || ""));
}

async function recordPaymentEvent(
  supabaseAdmin: any,
  args: {
    paymentId: string;
    providerRef?: string | null;
    source: "checkout" | "webhook" | "reconcile" | "provider" | "admin" | "system";
    eventType: string;
    severity?: "info" | "warn" | "error" | "critical";
    statusBefore?: string | null;
    statusAfter?: string | null;
    providerStatus?: string | null;
    amountCents?: number | null;
    httpStatus?: number | null;
    detail?: Record<string, unknown>;
  },
) {
  const { error } = await supabaseAdmin
    .from("payment_events")
    .insert({
      payment_id: args.paymentId,
      provider_ref: args.providerRef || null,
      source: args.source,
      event_type: args.eventType,
      severity: args.severity || "info",
      status_before: args.statusBefore || null,
      status_after: args.statusAfter || null,
      provider_status: args.providerStatus || null,
      amount_cents:
        Number.isFinite(Number(args.amountCents)) && Number(args.amountCents) >= 0
          ? Math.round(Number(args.amountCents))
          : null,
      http_status:
        Number.isFinite(Number(args.httpStatus)) && Number(args.httpStatus) >= 100
          ? Math.round(Number(args.httpStatus))
          : null,
      detail: args.detail || {},
    });

  if (error) {
    console.warn("[purincash] payment event write failed", args.eventType, error.message);
  }
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
  const method = String(init.method || "GET").toUpperCase();
  const requestOnce = async () => {
    try {
      const response = await fetch(`${PURINCASH_BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...(init.body ? JSON_HEADERS : {}),
          ...(init.headers || {}),
        },
        signal: init.signal || AbortSignal.timeout(15_000),
      });
      const body = await response.json().catch(() => ({}));
      return { response, body };
    } catch {
      return {
        response: new Response(JSON.stringify({ error: "PURINCASH_NETWORK_UNAVAILABLE" }), {
          status: 503,
          headers: JSON_HEADERS,
        }),
        body: { error: "PURINCASH_NETWORK_UNAVAILABLE", networkError: true },
      };
    }
  };

  const first = await requestOnce();
  const retryableGet =
    method === "GET" &&
    (first.body?.networkError === true || [502, 503, 504].includes(first.response.status));

  if (!retryableGet) return first;

  await new Promise((resolve) => setTimeout(resolve, 250));
  return requestOnce();
}

async function fetchProviderPayment(apiKey: string, providerId: string, kind: ProviderKind) {
  const path = kind === "charge"
    ? `/charges/${encodeURIComponent(providerId)}`
    : kind === "payment"
      ? `/payments/${encodeURIComponent(providerId)}`
      : `/card-payments/${encodeURIComponent(providerId)}`;
  return purincashRequest(apiKey, path);
}

function deliveredContentText(payload: any): string {
  const value = payload?.deliveredContent;
  if (typeof value === "string") return value.trim().slice(0, 200_000);
  if (Array.isArray(value)) {
    const parts = value.map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return "";
      for (const key of ["content", "value", "key", "credential"]) {
        if (typeof item[key] === "string" && item[key].trim()) return item[key].trim();
      }
      return "";
    }).filter(Boolean);
    return parts.join("\n").slice(0, 200_000);
  }
  if (value && typeof value === "object") {
    for (const key of ["content", "value", "key", "credential"]) {
      if (typeof value[key] === "string" && value[key].trim()) {
        return value[key].trim().slice(0, 200_000);
      }
    }
  }
  return "";
}

async function fetchProviderDelivery(apiKey: string, providerId: string) {
  return purincashRequest(apiKey, `/deliveries/${encodeURIComponent(providerId)}`);
}

function parseStorePriceCents(raw: any): number {
  for (const key of ["priceCents", "valueCents", "amountCents"]) {
    const direct = Number(raw?.[key]);
    if (Number.isFinite(direct) && direct >= 0) return Math.round(direct);
  }
  if (typeof raw?.price === "number" && Number.isFinite(raw.price) && raw.price >= 0) {
    return Math.round(raw.price * 100);
  }
  const text = String(raw?.price ?? raw?.value ?? "").trim();
  if (!text) return 0;
  const normalized = text.includes(",")
    ? text.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".")
    : text.replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

function inferSupplierPlanCode(name: string) {
  const value = name.toLowerCase();
  if (/lifetime|vital[ií]cio|permanente/.test(value)) return "lifetime";
  if (/90\s*d|90\s*dias|trimestral|3\s*mes/.test(value)) return "90d";
  if (/30\s*d|30\s*dias|mensal|1\s*mes/.test(value)) return "30d";
  if (/15\s*d|15\s*dias|quinzenal/.test(value)) return "15d";
  if (/7\s*d|7\s*dias|semanal/.test(value)) return "7d";
  if (/3\s*d|3\s*dias/.test(value)) return "3d";
  if (/1\s*d|1\s*dia|di[aá]rio/.test(value)) return "1d";
  if (/trial|teste/.test(value)) return "trial";
  return "custom";
}

function normalizeStoreProducts(payload: any) {
  let rawProducts: any[] = [];
  if (Array.isArray(payload)) rawProducts = payload;
  else if (Array.isArray(payload?.products)) rawProducts = payload.products;
  else if (Array.isArray(payload?.data)) rawProducts = payload.data;
  else if (Array.isArray(payload?.items)) rawProducts = payload.items;
  else if (Array.isArray(payload?.categories)) {
    rawProducts = payload.categories.flatMap((category: any) =>
      (Array.isArray(category?.products) ? category.products : []).map((product: any) => ({
        ...product,
        __categoryName: category?.name || category?.title || "",
      }))
    );
  }

  return rawProducts.slice(0, 1000).map((product: any) => {
    const publicCandidates = [
      product?.supplierProductId,
      product?.supplier?.productId,
      product?.publicProductId,
      product?.publicId,
    ].map((value) => String(value || "").trim());
    const supplierProductId = publicCandidates.find((value) => /^prod_[A-Za-z0-9_-]+$/.test(value)) || null;
    const storeProductId = String(
      product?.id ?? product?._id ?? product?.storeProductId ?? product?.publicId ?? supplierProductId ?? "",
    ).trim();
    const productName = String(product?.name ?? product?.title ?? "Produto").trim().slice(0, 160);
    const category = String(
      product?.category?.name ?? product?.categoryName ?? product?.__categoryName ?? product?.category ?? "",
    ).trim().slice(0, 120);
    const variations = (Array.isArray(product?.variations) ? product.variations : []).slice(0, 200).map(
      (variation: any, index: number) => {
        const stockValue =
          variation?.stock === null || variation?.stock === undefined
            ? null
            : Number(variation.stock);
        const stock = Number.isFinite(stockValue) && Number(stockValue) >= 0
          ? Math.trunc(Number(stockValue))
          : null;
        const name = String(variation?.name ?? variation?.title ?? variation?.label ?? `Variação ${index + 1}`)
          .trim().slice(0, 160);
        return {
          id: String(variation?.id ?? variation?._id ?? "").trim().slice(0, 200) || null,
          index,
          name,
          planCode: inferSupplierPlanCode(name),
          priceCents: parseStorePriceCents(variation),
          stock,
          unlimited: variation?.unlimited === true,
          active: product?.active !== false && variation?.active !== false,
        };
      },
    );
    return {
      storeProductId,
      supplierProductId,
      name: productName,
      category,
      active: product?.active !== false,
      variations,
    };
  }).filter((product: any) => product.storeProductId || product.supplierProductId);
}

async function fetchSupplierCatalog(apiKey: string) {
  const primary = await purincashRequest(apiKey, "/store/products?includeInactive=true");
  if (primary.response.ok) {
    return {
      response: primary.response,
      body: primary.body,
      products: normalizeStoreProducts(primary.body),
    };
  }

  // PurinCash documents this second read-only view of the same store catalog.
  // It is a safe fallback if the dedicated /store/products route is temporarily unavailable.
  const fallback = await purincashRequest(apiKey, "/products?include=store&includeInactive=true");
  return {
    response: fallback.response,
    body: fallback.body,
    products: fallback.response.ok ? normalizeStoreProducts(fallback.body) : [],
  };
}

function supplierFromCheckout(checkout: any) {
  const items = Array.isArray(checkout?.cartSnapshot) ? checkout.cartSnapshot : [];
  const supplierItems = items.filter(
    (item: any) => item?.type === "purincash-supplier" || item?.deliveryMode === "purincash_supplier",
  );
  if (!supplierItems.length) return null;
  if (supplierItems.length !== 1 || items.length !== 1 || Number(supplierItems[0]?.quantity || 1) !== 1) {
    throw new Error("SUPPLIER_CART_UNSUPPORTED");
  }
  const item = supplierItems[0];
  const productId = String(item?.supplierProductId || "");
  const variationIndex = Number(item?.supplierVariationIndex);
  if (
    item?.supplierProvider !== "purincash" ||
    !/^prod_[A-Za-z0-9_-]+$/.test(productId) ||
    !Number.isInteger(variationIndex) ||
    variationIndex < 0
  ) {
    throw new Error("SUPPLIER_BINDING_INVALID");
  }
  return {
    item,
    productId,
    variationIndex,
    variationId: item?.supplierVariationId ? String(item.supplierVariationId) : null,
    storeProductId: item?.supplierStoreProductId ? String(item.supplierStoreProductId) : null,
  };
}

async function markSupplierNeedsReview(supabaseAdmin: any, checkout: any) {
  const item = (Array.isArray(checkout?.cartSnapshot) ? checkout.cartSnapshot : []).find(
    (candidate: any) => candidate?.type === "purincash-supplier" || candidate?.deliveryMode === "purincash_supplier",
  );
  if (!item?.planId) return;
  await supabaseAdmin.rpc("mark_purincash_supplier_binding_status", {
    p_plan_id: item.planId,
    p_status: "needs_review",
  });
}

async function validateSupplierCheckout(apiKey: string, checkout: any) {
  const supplier = supplierFromCheckout(checkout);
  if (!supplier) return null;

  const catalog = await fetchSupplierCatalog(apiKey);
  if (!catalog.response.ok) throw new Error("SUPPLIER_CATALOG_UNAVAILABLE");

  const product = catalog.products.find((candidate: any) =>
    (supplier.storeProductId && candidate.storeProductId === supplier.storeProductId) ||
    candidate.supplierProductId === supplier.productId
  );
  if (!product || product.active === false) throw new Error("SUPPLIER_PRODUCT_UNAVAILABLE");

  let variation = supplier.variationId
    ? product.variations.find((candidate: any) => candidate.id === supplier.variationId)
    : null;
  if (!variation) variation = product.variations[supplier.variationIndex] || null;
  if (!variation || variation.active === false) throw new Error("SUPPLIER_VARIATION_UNAVAILABLE");
  if (
    !variation.unlimited &&
    (variation.stock === null || !Number.isFinite(Number(variation.stock)) || Number(variation.stock) <= 0)
  ) {
    throw new Error("SUPPLIER_OUT_OF_STOCK");
  }

  const publicId = product.supplierProductId || supplier.productId;
  if (!/^prod_[A-Za-z0-9_-]+$/.test(publicId)) throw new Error("SUPPLIER_PUBLIC_ID_REQUIRED");
  if (product.supplierProductId && product.supplierProductId !== supplier.productId) {
    throw new Error("SUPPLIER_BINDING_CHANGED");
  }

  supplier.item.supplierVariationIndex = variation.index;
  supplier.item.supplierVariationId = variation.id || supplier.variationId || null;
  supplier.item.supplierStoreProductId = product.storeProductId || supplier.storeProductId || null;

  return { productId: publicId, variationIndex: variation.index };
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
  purincashApiKey: string,
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

  const supplierItem = proof.cartSnapshot.find(
    (item: any) => item?.type === "purincash-supplier" || item?.deliveryMode === "purincash_supplier",
  );
  let supplierDeliveredContent = "";
  if (supplierItem) {
    if (!purincashApiKey) return { ok: false, status: 500, error: "Integração de fornecedor indisponível" };
    supplierDeliveredContent = deliveredContentText(providerPayload);
    if (!supplierDeliveredContent) {
      const delivery = await fetchProviderDelivery(purincashApiKey, String(payment.charge_id || ""));
      if (delivery.response.ok) supplierDeliveredContent = deliveredContentText(delivery.body);
    }
    if (!supplierDeliveredContent) {
      return {
        ok: false,
        status: 409,
        error: "Pagamento confirmado, aguardando a entrega automática do fornecedor.",
        retryable: true,
      };
    }
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
    await fulfillOrder(
      supabaseAdmin,
      {
        ...payment,
        cart_snapshot: proof.cartSnapshot,
      },
      {
        providerPaymentId: String(payment.charge_id || ""),
        supplierDeliveredContent: supplierDeliveredContent || null,
      },
    );

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

async function reserveCheckoutInventory(supabaseAdmin: any, paymentId: string, checkout: any) {
  const { data, error } = await supabaseAdmin.rpc("reserve_checkout_stock", {
    p_payment_id: paymentId,
    p_cart_snapshot: checkout.cartSnapshot,
    p_ttl_minutes: 60,
  });

  if (!error) return { ok: true as const, data };

  const message = String(error.message || error.code || "STOCK_RESERVATION_FAILED");
  if (message.includes("OUT_OF_STOCK")) {
    return {
      ok: false as const,
      status: 409,
      error: "Um dos planos acabou de esgotar. Atualize o carrinho e tente novamente.",
    };
  }

  console.error("[purincash] stock reservation failed", paymentId, message);
  return {
    ok: false as const,
    status: 500,
    error: "Não foi possível reservar o estoque com segurança.",
  };
}

async function releaseCheckoutInventory(supabaseAdmin: any, paymentId: string) {
  const { error } = await supabaseAdmin.rpc("release_checkout_stock", {
    p_payment_id: paymentId,
  });
  if (error) {
    console.warn("[purincash] stock reservation release failed", paymentId, error.message);
  }
}

async function extendCheckoutInventory(
  supabaseAdmin: any,
  paymentId: string,
  expiresAt: string | null | undefined,
) {
  if (!expiresAt) return;

  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return;

  const { error } = await supabaseAdmin.rpc("extend_checkout_stock", {
    p_payment_id: paymentId,
    p_expires_at: parsed.toISOString(),
  });
  if (error) {
    console.warn("[purincash] stock reservation expiry sync failed", paymentId, error.message);
  }
}

async function failCheckoutAttempt(supabaseAdmin: any, paymentId: string) {
  await releaseCheckoutInventory(supabaseAdmin, paymentId);
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

    const fulfillment = await claimAndFulfill(
      supabaseAdmin,
      payment,
      providerData,
      providerKind,
      CHECKOUT_SIGNING_SECRET,
      PURINCASH_API_KEY,
    );
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

  if (["supplier-catalog", "supplier-import", "supplier-bind", "supplier-sync"].includes(action)) {
    const { data: isAdmin, error: adminError } = await supabaseUser.rpc("is_current_admin");
    if (adminError || isAdmin !== true) return json({ error: "Forbidden" }, 403);
    if (!PURINCASH_API_KEY) return json({ error: "Integração PurinCash não configurada" }, 503);

    const catalog = await fetchSupplierCatalog(PURINCASH_API_KEY);
    if (!catalog.response.ok) {
      if (catalog.response.status === 429) {
        return json({ error: "A PurinCash limitou temporariamente as consultas. Aguarde e tente novamente." }, 429);
      }
      if ([502, 503, 504].includes(catalog.response.status)) {
        return json({ error: "A PurinCash está temporariamente indisponível. Tente atualizar o catálogo em alguns segundos." }, 503);
      }
      return json({ error: "Não foi possível consultar o catálogo do provedor." }, 502);
    }

    if (action === "supplier-catalog" && req.method === "GET") {
      return json({ products: catalog.products, syncedAt: new Date().toISOString() });
    }

    if (action === "supplier-import" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const productId = String(body?.productId || "").trim();
      const selections = Array.isArray(body?.selections) ? body.selections.slice(0, 50) : [];
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId) || !selections.length) {
        return json({ error: "Seleção de fornecedor inválida." }, 400);
      }

      const importItems: any[] = [];
      for (const selection of selections) {
        const storeProductId = String(selection?.storeProductId || "").trim();
        const suppliedPublicId = String(selection?.supplierProductId || "").trim();
        const requestedVariationId = String(selection?.variationId || "").trim();
        const requestedIndex = Number(selection?.variationIndex);

        const product = catalog.products.find((candidate: any) =>
          (storeProductId && candidate.storeProductId === storeProductId) ||
          (suppliedPublicId && candidate.supplierProductId === suppliedPublicId)
        );
        if (!product) return json({ error: "Produto do provedor não encontrado. Atualize o catálogo." }, 409);

        let variation = requestedVariationId
          ? product.variations.find((candidate: any) => candidate.id === requestedVariationId)
          : null;
        if (!variation && Number.isInteger(requestedIndex) && requestedIndex >= 0) {
          variation = product.variations[requestedIndex] || null;
        }
        if (!variation) return json({ error: "Variação do provedor mudou. Atualize o catálogo." }, 409);
        if (!variation.active || (!variation.unlimited && (variation.stock === null || Number(variation.stock) <= 0))) {
          return json({ error: "Esta variação está indisponível no provedor." }, 409);
        }

        const supplierProductId = product.supplierProductId || suppliedPublicId;
        if (!/^prod_[A-Za-z0-9_-]+$/.test(supplierProductId)) {
          return json({ error: "Informe o ID público do fornecedor no formato prod_... para este produto." }, 400);
        }
        if (product.supplierProductId && suppliedPublicId && product.supplierProductId !== suppliedPublicId) {
          return json({ error: "O ID público informado não corresponde ao catálogo atual." }, 409);
        }

        importItems.push({
          name: variation.name,
          plan_code: variation.planCode,
          price_cents: variation.priceCents,
          active: variation.active === true,
          supplier_product_id: supplierProductId,
          supplier_variation_id: variation.id,
          supplier_variation_index: variation.index,
          supplier_store_product_id: product.storeProductId,
          supplier_display_name: product.name,
          supplier_variation_name: variation.name,
          supplier_stock: variation.stock,
          supplier_unlimited: variation.unlimited === true,
        });
      }

      const { data, error } = await supabaseUser.rpc("admin_import_purincash_supplier_plans", {
        p_product_id: productId,
        p_items: importItems,
      });
      if (error) return json({ error: "Não foi possível importar as variações selecionadas." }, 409);
      return json({ imported: data });
    }

    if (action === "supplier-bind" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const planId = String(body?.planId || "").trim();
      const selection = body?.selection || {};
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId)) {
        return json({ error: "Plano inválido." }, 400);
      }

      const storeProductId = String(selection?.storeProductId || "").trim();
      const suppliedPublicId = String(selection?.supplierProductId || "").trim();
      const requestedVariationId = String(selection?.variationId || "").trim();
      const requestedIndex = Number(selection?.variationIndex);
      const product = catalog.products.find((candidate: any) =>
        (storeProductId && candidate.storeProductId === storeProductId) ||
        (suppliedPublicId && candidate.supplierProductId === suppliedPublicId)
      );
      if (!product) return json({ error: "Produto do provedor não encontrado. Atualize o catálogo." }, 409);

      let variation = requestedVariationId
        ? product.variations.find((candidate: any) => candidate.id === requestedVariationId)
        : null;
      if (!variation && Number.isInteger(requestedIndex) && requestedIndex >= 0) {
        variation = product.variations[requestedIndex] || null;
      }
      if (!variation) return json({ error: "Variação do provedor mudou. Atualize o catálogo." }, 409);
      if (!variation.active || (!variation.unlimited && (variation.stock === null || Number(variation.stock) <= 0))) {
        return json({ error: "Esta variação está indisponível no provedor." }, 409);
      }

      const supplierProductId = product.supplierProductId || suppliedPublicId;
      if (!/^prod_[A-Za-z0-9_-]+$/.test(supplierProductId)) {
        return json({ error: "Informe o ID público do fornecedor no formato prod_... para este produto." }, 400);
      }
      if (product.supplierProductId && suppliedPublicId && product.supplierProductId !== suppliedPublicId) {
        return json({ error: "O ID público informado não corresponde ao catálogo atual." }, 409);
      }

      const { error } = await supabaseUser.rpc("admin_bind_purincash_supplier_plan", {
        p_plan_id: planId,
        p_item: {
          price_cents: variation.priceCents,
          supplier_product_id: supplierProductId,
          supplier_variation_id: variation.id,
          supplier_variation_index: variation.index,
          supplier_store_product_id: product.storeProductId,
          supplier_display_name: product.name,
          supplier_variation_name: variation.name,
          supplier_stock: variation.stock,
          supplier_unlimited: variation.unlimited === true,
        },
      });
      if (error) return json({ error: "Não foi possível trocar o vínculo deste plano." }, 409);
      return json({ bound: true, planId });
    }

    if (action === "supplier-sync" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const planId = String(body?.planId || "").trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId)) {
        return json({ error: "Plano inválido." }, 400);
      }

      const { data: binding, error: bindingError } = await supabaseUser.rpc(
        "admin_get_purincash_supplier_binding",
        { p_plan_id: planId },
      );
      if (bindingError || !binding) return json({ error: "Vínculo do provedor não encontrado." }, 404);

      const product = catalog.products.find((candidate: any) =>
        (binding.supplier_store_product_id && candidate.storeProductId === binding.supplier_store_product_id) ||
        candidate.supplierProductId === binding.supplier_product_id
      );
      if (!product) return json({ error: "Produto não está mais disponível no provedor." }, 409);

      let variation = binding.supplier_variation_id
        ? product.variations.find((candidate: any) => candidate.id === binding.supplier_variation_id)
        : null;
      const oldIndex = Number(binding.supplier_variation_index);
      if (!variation && Number.isInteger(oldIndex) && oldIndex >= 0) {
        variation = product.variations[oldIndex] || null;
      }
      if (!variation) return json({ error: "A variação mudou ou foi removida no provedor." }, 409);

      const supplierProductId = product.supplierProductId || String(binding.supplier_product_id || "");
      const { error: syncError } = await supabaseUser.rpc("admin_sync_purincash_supplier_binding", {
        p_plan_id: planId,
        p_supplier_product_id: supplierProductId,
        p_supplier_variation_id: variation.id,
        p_supplier_variation_index: variation.index,
        p_supplier_store_product_id: product.storeProductId,
        p_supplier_display_name: product.name,
        p_supplier_variation_name: variation.name,
        p_catalog_price_cents: variation.priceCents,
        p_stock: variation.stock,
        p_unlimited: variation.unlimited === true,
      });
      if (syncError) return json({ error: "Não foi possível sincronizar este vínculo." }, 409);
      return json({
        synced: true,
        variation,
        product: { name: product.name, supplierProductId, storeProductId: product.storeProductId },
      });
    }

    return json({ error: "Ação de fornecedor inválida." }, 405);
  }

  if (action === "admin-reconcile" && req.method === "POST") {
    const { data: isAdmin, error: adminError } = await supabaseUser.rpc("is_current_admin");
    if (adminError || isAdmin !== true) return json({ error: "Forbidden" }, 403);
    if (!PURINCASH_API_KEY) return json({ error: "PURINCASH_API_KEY not configured" }, 500);
    if (!CHECKOUT_SIGNING_SECRET) return json({ error: "Checkout signing secret not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const paymentId = String(body?.payment_id || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) {
      return json({ error: "payment_id inválido" }, 400);
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentError || !payment) return json({ error: "Pagamento não encontrado" }, 404);

    const { data: reconcileRequest } = await supabaseAdmin
      .from("payment_reconcile_requests")
      .select("id,status,status_before")
      .eq("payment_id", paymentId)
      .in("status", ["queued", "running"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reconcileRequest?.id && reconcileRequest.status === "queued") {
      await supabaseAdmin
        .from("payment_reconcile_requests")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status_before: reconcileRequest.status_before || payment.status,
        })
        .eq("id", reconcileRequest.id)
        .eq("status", "queued");
    }

    const finishReconcile = async (
      status: "completed" | "failed",
      values: {
        providerStatus?: string | null;
        statusAfter?: string | null;
        errorCode?: string | null;
      },
    ) => {
      if (!reconcileRequest?.id) return;
      await supabaseAdmin
        .from("payment_reconcile_requests")
        .update({
          status,
          provider_status: values.providerStatus || null,
          status_before: reconcileRequest.status_before || payment.status,
          status_after: values.statusAfter || payment.status,
          last_error_code: values.errorCode || null,
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reconcileRequest.id);
    };

    if (!payment.charge_id) {
      await finishReconcile("failed", {
        statusAfter: payment.status,
        errorCode: "PROVIDER_REFERENCE_MISSING",
      });
      await recordPaymentEvent(supabaseAdmin, {
        paymentId,
        source: "reconcile",
        eventType: "reconcile.failed",
        severity: "error",
        statusBefore: payment.status,
        statusAfter: payment.status,
        detail: {
          request_id: reconcileRequest?.id || null,
          error_code: "PROVIDER_REFERENCE_MISSING",
        },
      });
      return json({ error: "Pagamento sem referência do gateway" }, 409);
    }

    const providerKind = providerKindFromPayment(payment);
    const { response: providerResponse, body: providerData } =
      await fetchProviderPayment(PURINCASH_API_KEY, payment.charge_id, providerKind);

    const providerStatusRaw = String(providerData?.status || "");
    const providerStatus = normalizeProviderStatus(providerStatusRaw);
    const providerAmount = providerAmountCents(providerData, providerKind);
    const expectedAmount = Math.round(Number(payment.amount));

    if (!providerResponse.ok) {
      const errorCode = "PROVIDER_HTTP_" + providerResponse.status;
      await finishReconcile("failed", {
        providerStatus: providerStatusRaw || null,
        statusAfter: payment.status,
        errorCode,
      });
      await recordPaymentEvent(supabaseAdmin, {
        paymentId,
        providerRef: payment.charge_id,
        source: "reconcile",
        eventType: "reconcile.provider_error",
        severity: "error",
        statusBefore: payment.status,
        statusAfter: payment.status,
        providerStatus: providerStatusRaw || null,
        httpStatus: providerResponse.status,
        detail: {
          request_id: reconcileRequest?.id || null,
          provider_kind: providerKind,
          error_code: errorCode,
        },
      });
      return json({ error: "Gateway indisponível para reconciliação" }, 502);
    }

    if (
      providerAmount !== null &&
      Number.isFinite(expectedAmount) &&
      providerAmount !== expectedAmount
    ) {
      await finishReconcile("failed", {
        providerStatus: providerStatusRaw || providerStatus,
        statusAfter: payment.status,
        errorCode: "AMOUNT_MISMATCH",
      });
      await recordPaymentEvent(supabaseAdmin, {
        paymentId,
        providerRef: payment.charge_id,
        source: "reconcile",
        eventType: "reconcile.amount_mismatch",
        severity: "critical",
        statusBefore: payment.status,
        statusAfter: payment.status,
        providerStatus: providerStatusRaw || providerStatus,
        amountCents: providerAmount,
        httpStatus: providerResponse.status,
        detail: {
          request_id: reconcileRequest?.id || null,
          provider_kind: providerKind,
          expected_amount_cents: expectedAmount,
        },
      });
      return json({ error: "Valor do gateway diverge do pedido" }, 409);
    }

    let internalStatus = String(payment.status || "ACTIVE");
    let fulfilled = false;
    let alreadyClaimed = false;

    if (providerStatus === "COMPLETED") {
      if (internalStatus === "COMPLETED") {
        // Already reconciled.
      } else if (["ACTIVE", "EXPIRED", "FULFILLING"].includes(internalStatus)) {
        const fulfillment = await claimAndFulfill(
          supabaseAdmin,
          payment,
          providerData,
          providerKind,
          CHECKOUT_SIGNING_SECRET,
          PURINCASH_API_KEY,
        );

        if (!fulfillment.ok) {
          const errorCode = "FULFILLMENT_RECONCILE_FAILED";
          await finishReconcile("failed", {
            providerStatus: providerStatusRaw || providerStatus,
            statusAfter: internalStatus,
            errorCode,
          });
          await recordPaymentEvent(supabaseAdmin, {
            paymentId,
            providerRef: payment.charge_id,
            source: "reconcile",
            eventType: "reconcile.fulfillment_failed",
            severity: "error",
            statusBefore: payment.status,
            statusAfter: internalStatus,
            providerStatus: providerStatusRaw || providerStatus,
            amountCents: providerAmount,
            httpStatus: providerResponse.status,
            detail: {
              request_id: reconcileRequest?.id || null,
              provider_kind: providerKind,
              error_code: errorCode,
            },
          });
          return json({ error: fulfillment.error || "Falha no fulfillment" }, fulfillment.status || 409);
        }

        alreadyClaimed = fulfillment.alreadyClaimed === true;
        fulfilled = !alreadyClaimed;

        const { data: currentPayment } = await supabaseAdmin
          .from("payments")
          .select("status")
          .eq("id", paymentId)
          .maybeSingle();
        internalStatus = String(currentPayment?.status || internalStatus);
      } else {
        const errorCode = "PAID_UNSAFE_INTERNAL_STATUS";
        await finishReconcile("failed", {
          providerStatus: providerStatusRaw || providerStatus,
          statusAfter: internalStatus,
          errorCode,
        });
        await recordPaymentEvent(supabaseAdmin, {
          paymentId,
          providerRef: payment.charge_id,
          source: "reconcile",
          eventType: "reconcile.manual_review_required",
          severity: "critical",
          statusBefore: payment.status,
          statusAfter: internalStatus,
          providerStatus: providerStatusRaw || providerStatus,
          amountCents: providerAmount,
          httpStatus: providerResponse.status,
          detail: {
            request_id: reconcileRequest?.id || null,
            provider_kind: providerKind,
            error_code: errorCode,
          },
        });
        return json({
          error: "Gateway confirma pagamento, mas o status interno exige revisão manual",
          providerStatus,
          internalStatus,
        }, 409);
      }
    } else if (["EXPIRED", "FAILED", "CANCELLED"].includes(providerStatus)) {
      if (!["COMPLETED", "FULFILLING"].includes(internalStatus)) {
        const { data: updated } = await supabaseAdmin
          .from("payments")
          .update({
            status: providerStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentId)
          .neq("status", "COMPLETED")
          .neq("status", "FULFILLING")
          .select("status")
          .maybeSingle();
        internalStatus = String(updated?.status || internalStatus);
      }
    } else if (providerStatus === "ACTIVE" && internalStatus === "EXPIRED") {
      const { data: updated } = await supabaseAdmin
        .from("payments")
        .update({
          status: "ACTIVE",
          expires_at: providerData?.expiresAt || payment.expires_at || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .eq("status", "EXPIRED")
        .select("status")
        .maybeSingle();
      internalStatus = String(updated?.status || internalStatus);
    }

    await finishReconcile("completed", {
      providerStatus: providerStatusRaw || providerStatus,
      statusAfter: internalStatus,
      errorCode: null,
    });

    await recordPaymentEvent(supabaseAdmin, {
      paymentId,
      providerRef: payment.charge_id,
      source: "reconcile",
      eventType: "reconcile.completed",
      severity: "info",
      statusBefore: payment.status,
      statusAfter: internalStatus,
      providerStatus: providerStatusRaw || providerStatus,
      amountCents: providerAmount,
      httpStatus: providerResponse.status,
      detail: {
        request_id: reconcileRequest?.id || null,
        provider_kind: providerKind,
        fulfilled,
        already_claimed: alreadyClaimed,
      },
    });

    return json({
      success: true,
      payment_id: paymentId,
      providerStatus,
      internalStatus,
      fulfilled,
      alreadyClaimed,
    });
  }

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

    let supplier: { productId: string; variationIndex: number } | null = null;
    try {
      supplier = await validateSupplierCheckout(PURINCASH_API_KEY, checkout);
    } catch {
      return json({ error: "O produto do fornecedor precisa ser atualizado antes da compra." }, 409);
    }

    const reservation = await reserveCheckoutAttempt(supabaseAdmin, {
      id: internalPaymentId,
      userId,
      idempotencyKey,
      method: "pix",
      checkout,
    });
    if (reservation.error) return json({ error: reservation.error }, 500);
    if (!reservation.created) return replayCheckout(reservation.payment);

    const inventory = await reserveCheckoutInventory(
      supabaseAdmin,
      internalPaymentId,
      checkout,
    );
    if (!inventory.ok) {
      await failCheckoutAttempt(supabaseAdmin, internalPaymentId);
      return json({ error: inventory.error }, inventory.status);
    }

    const customer = await getCustomer();
    const { response, body: provider } = await purincashRequest(PURINCASH_API_KEY, "/charges", {
      method: "POST",
      body: JSON.stringify({
        valueCents: checkout.total,
        description: String(body?.description || "Compra CRAZZY PROJECT").slice(0, 200),
        expiresIn: 1800,
        callbackUrl,
        customer,
        ...(supplier ? { supplier } : {}),
        metadata: JSON.stringify({ source: "crazzy-project", orderId: internalPaymentId, userId }),
      }),
    });
    if (!response.ok || !provider?.paymentId) {
      if (supplier && (response.status === 400 || response.status === 403)) {
        await markSupplierNeedsReview(supabaseAdmin, checkout);
      }
      await failCheckoutAttempt(supabaseAdmin, internalPaymentId);
      return json({ error: provider?.error || "Erro ao criar cobrança PIX" }, response.status || 502);
    }

    await extendCheckoutInventory(supabaseAdmin, internalPaymentId, provider?.expiresAt || null);

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
    try {
      if (supplierFromCheckout(checkout)) {
        return json({ error: "Pagamento por cartão não está disponível para produtos de fornecedor." }, 400);
      }
    } catch {
      return json({ error: "Carrinho de fornecedor inválido." }, 400);
    }

    const reservation = await reserveCheckoutAttempt(supabaseAdmin, {
      id: internalPaymentId,
      userId,
      idempotencyKey,
      method: "card",
      checkout,
    });
    if (reservation.error) return json({ error: reservation.error }, 500);
    if (!reservation.created) return replayCheckout(reservation.payment);

    const inventory = await reserveCheckoutInventory(
      supabaseAdmin,
      internalPaymentId,
      checkout,
    );
    if (!inventory.ok) {
      await failCheckoutAttempt(supabaseAdmin, internalPaymentId);
      return json({ error: inventory.error }, inventory.status);
    }

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

    await extendCheckoutInventory(supabaseAdmin, internalPaymentId, provider?.expiresAt || null);

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

    let supplier: { productId: string; variationIndex: number } | null = null;
    try {
      supplier = await validateSupplierCheckout(PURINCASH_API_KEY, checkout);
    } catch {
      return json({ error: "O produto do fornecedor precisa ser atualizado antes da compra." }, 409);
    }

    const reservation = await reserveCheckoutAttempt(supabaseAdmin, {
      id: internalPaymentId,
      userId,
      idempotencyKey,
      method: "crypto",
      checkout,
    });
    if (reservation.error) return json({ error: reservation.error }, 500);
    if (!reservation.created) return replayCheckout(reservation.payment);

    const inventory = await reserveCheckoutInventory(
      supabaseAdmin,
      internalPaymentId,
      checkout,
    );
    if (!inventory.ok) {
      await failCheckoutAttempt(supabaseAdmin, internalPaymentId);
      return json({ error: inventory.error }, inventory.status);
    }

    const customer = await getCustomer();
    const { response, body: provider } = await purincashRequest(PURINCASH_API_KEY, "/payments", {
      method: "POST",
      body: JSON.stringify({
        paymentMethod: "ltc",
        valueCents: checkout.total,
        description: String(body?.description || "Compra CRAZZY PROJECT").slice(0, 200),
        callbackUrl,
        customer,
        ...(supplier ? { supplier } : {}),
        metadata: JSON.stringify({ source: "crazzy-project", orderId: internalPaymentId, userId }),
      }),
    });
    if (!response.ok || !provider?.paymentId || !provider?.ltc?.address) {
      if (supplier && (response.status === 400 || response.status === 403)) {
        await markSupplierNeedsReview(supabaseAdmin, checkout);
      }
      await failCheckoutAttempt(supabaseAdmin, internalPaymentId);
      return json({ error: provider?.error || "Erro ao criar pagamento em Litecoin" }, response.status || 502);
    }

    await extendCheckoutInventory(supabaseAdmin, internalPaymentId, provider?.expiresAt || null);

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
      const fulfillment = await claimAndFulfill(
        supabaseAdmin,
        payment,
        provider,
        providerKind,
        CHECKOUT_SIGNING_SECRET,
        PURINCASH_API_KEY,
      );
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

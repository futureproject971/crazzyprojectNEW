import { comboTiersFromDiscounts, discountForCount } from "./combo-policy.ts";

export interface CheckoutCartItem {
  productId: string;
  planId: string;
  quantity: number;
  type?: string;
  lztItemId?: string;
  lztPrice?: number;
  lztCurrency?: string;
  lztGame?: string;
  productName?: string;
  productImage?: string | null;
  planName?: string;
  price?: number;
  resellerDiscountPercent?: number;
  skinsCount?: number | null;
  planCode?: string | null;
  campaignSlug?: string;
}

type DiscountSource = "none" | "combo" | "coupon";

export interface AuthoritativeCheckout {
  total: number;
  subtotal: number;
  discountAmount: number;
  cartSnapshot: CheckoutCartItem[];
  couponId: string | null;
  comboDiscountAmount?: number;
  couponDiscountAmount?: number;
  discountSource?: DiscountSource;
  error?: string;
}

const MAX_ITEM_QUANTITY = 20;

/**
 * Builds an authoritative checkout snapshot. Client prices/names are display-only and
 * are never trusted for regular products. The result is safe to persist on payments.
 */
export async function calculateServerTotal(
  supabaseAdmin: any,
  cartItems: CheckoutCartItem[],
  couponId: string | null,
  userId: string,
): Promise<AuthoritativeCheckout> {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Carrinho vazio" };
  }

  if (cartItems.length > 50) {
    return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Carrinho excede o limite de itens" };
  }

  let subtotal = 0;
  const cartSnapshot: CheckoutCartItem[] = [];

  const { data: resellerData } = await supabaseAdmin
    .from("resellers")
    .select("id, discount_percent, total_purchases, expires_at")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  const activeReseller =
    resellerData && (!resellerData.expires_at || new Date(resellerData.expires_at).getTime() > Date.now())
      ? resellerData
      : null;

  let resellerAllowedProductIds: string[] | null = null;
  if (activeReseller) {
    const { data: resellerProducts } = await supabaseAdmin
      .from("reseller_products")
      .select("product_id")
      .eq("reseller_id", activeReseller.id);
    const ids = (resellerProducts || []).map((p: any) => p.product_id);
    resellerAllowedProductIds = ids.length > 0 ? ids : null;
  }

  for (const rawItem of cartItems) {
    const qtyRaw = Number(rawItem.quantity ?? 1);
    if (!Number.isInteger(qtyRaw) || qtyRaw < 1 || qtyRaw > MAX_ITEM_QUANTITY) {
      return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: `Quantidade inválida. Máximo ${MAX_ITEM_QUANTITY} por item.` };
    }
    const qty = qtyRaw;
    if (rawItem.type === "luck-play") {
      return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Jogadas do CRAZZY ARCADE usam somente CRAZZY BONUS." };
    }

    const isLztAccount = rawItem.type === "lzt-account" || rawItem.planId === "lzt-account" || (rawItem.planId || "").startsWith("lzt-");

    if (isLztAccount) {
      // External account purchases spend money at a third-party provider. Keep the
      // feature fail-closed until an operator explicitly enables it after the new
      // database and reconciliation flow are online. This prevents accepting a
      // customer payment when we cannot guarantee exactly-once provider purchase.
      if (Deno.env.get("ENABLE_LZT_AUTO_BUY") !== "true") {
        return {
          total: 0,
          subtotal: 0,
          discountAmount: 0,
          cartSnapshot: [],
          couponId: null,
          error: "Venda automática de contas temporariamente indisponível.",
        };
      }

      const lztItemId = rawItem.lztItemId || rawItem.productId?.replace(/^lzt-(lol|fortnite|minecraft)-/, "").replace(/^lzt-/, "") || "";
      if (!lztItemId || !/^[A-Za-z0-9_-]+$/.test(lztItemId)) {
        return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Conta externa inválida" };
      }

      const LZT_TOKEN = Deno.env.get("LZT_MARKET_TOKEN");
      if (!LZT_TOKEN) {
        return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Configuração de fornecedor ausente. Contate o suporte." };
      }

      const { data: lztConfig } = await supabaseAdmin
        .from("lzt_config")
        .select("markup_multiplier, markup_valorant, markup_lol, markup_fortnite, markup_minecraft")
        .limit(1)
        .maybeSingle();

      const game = rawItem.lztGame;
      let markup = Number(lztConfig?.markup_multiplier || 1.5);
      if (game && lztConfig) {
        const m = lztConfig as any;
        if (game === "valorant" && m.markup_valorant != null) markup = Number(m.markup_valorant);
        else if (game === "lol" && m.markup_lol != null) markup = Number(m.markup_lol);
        else if (game === "fortnite" && m.markup_fortnite != null) markup = Number(m.markup_fortnite);
        else if (game === "minecraft" && m.markup_minecraft != null) markup = Number(m.markup_minecraft);
      }
      if (!Number.isFinite(markup) || markup <= 0) {
        return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Markup do fornecedor inválido" };
      }

      try {
        const detailRes = await fetch(`https://api.lzt.market/${encodeURIComponent(lztItemId)}?currency=brl`, {
          headers: { Authorization: `Bearer ${LZT_TOKEN}`, Accept: "application/json" },
        });
        if (!detailRes.ok) {
          return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Não foi possível verificar o preço da conta. Tente novamente." };
        }

        const detailData = await detailRes.json();
        const lztPriceRaw = Number(detailData.item?.price || 0);
        const currency = String(detailData.item?.price_currency || "brl").toLowerCase();
        if (!Number.isFinite(lztPriceRaw) || lztPriceRaw <= 0) {
          return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: `Conta #${lztItemId} indisponível ou sem preço.` };
        }

        if (currency !== "brl") {
          return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Moeda da conta externa não está em BRL" };
        }
        const unitPriceCents = Math.round(lztPriceRaw * markup * 100);
        subtotal += unitPriceCents * qty;
        cartSnapshot.push({
          productId: rawItem.productId,
          planId: rawItem.planId,
          quantity: qty,
          type: "lzt-account",
          lztItemId,
          lztPrice: lztPriceRaw,
          lztCurrency: currency,
          lztGame: game,
          productName: String(detailData.item?.title || rawItem.productName || `Conta #${lztItemId}`).slice(0, 200),
          productImage: rawItem.productImage || null,
          planName: rawItem.planName || "Conta",
          price: unitPriceCents / 100,
          skinsCount: rawItem.skinsCount ?? null,
        });
      } catch (error) {
        console.error("LZT price fetch failed", error);
        return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Erro ao verificar preço da conta. Tente novamente." };
      }
      continue;
    }

    if (!rawItem.productId || !rawItem.planId) {
      return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Produto ou plano inválido" };
    }

    const { data: planData, error: planError } = await supabaseAdmin
      .from("product_plans")
      .select("id, name, price, active, product_id, plan_code")
      .eq("id", rawItem.planId)
      .eq("active", true)
      .maybeSingle();
    if (planError || !planData || planData.product_id !== rawItem.productId) {
      return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Plano não pertence ao produto selecionado ou está inativo" };
    }

    const { data: productData, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, image_url, active")
      .eq("id", planData.product_id)
      .eq("active", true)
      .maybeSingle();
    if (productError || !productData) {
      return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Produto não encontrado ou inativo" };
    }

    let unitPriceCents = Math.round(Number(planData.price) * 100);
    if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) {
      return { total: 0, subtotal: 0, discountAmount: 0, cartSnapshot: [], couponId: null, error: "Preço inválido no catálogo" };
    }

    let resellerDiscountPercent = 0;
    if (activeReseller && (!resellerAllowedProductIds || resellerAllowedProductIds.includes(planData.product_id))) {
      resellerDiscountPercent = Math.max(0, Math.min(100, Number(activeReseller.discount_percent || 0)));
      unitPriceCents = Math.round(unitPriceCents * (1 - resellerDiscountPercent / 100));
    }

    subtotal += unitPriceCents * qty;
    cartSnapshot.push({
      productId: productData.id,
      productName: productData.name,
      productImage: productData.image_url || null,
      planId: planData.id,
      planName: planData.name,
      planCode: planData.plan_code || null,
      price: unitPriceCents / 100,
      resellerDiscountPercent,
      quantity: qty,
    });
  }

  let total = subtotal;
  let discountAmount = 0;
  let validatedCouponId: string | null = null;

  let comboDiscountAmount = 0;
  const comboGroups = new Map<string, { products: Set<string>; subtotal: number }>();
  for (const item of cartSnapshot) {
    const code = String(item.planCode || "");
    if (code !== "30d" && code !== "lifetime") continue;
    if (item.type === "lzt-account") continue;
    const group = comboGroups.get(code) || { products: new Set<string>(), subtotal: 0 };
    group.products.add(item.productId);
    group.subtotal += Math.round(Number(item.price || 0) * 100) * Math.max(1, Number(item.quantity || 1));
    comboGroups.set(code, group);
  }
  if ([...comboGroups.values()].some(group => group.products.size >= 2)) {
    const { data: settings, error } = await supabaseAdmin.from("commerce_combo_settings").select("discounts").eq("id", true).maybeSingle();
    const tiers = comboTiersFromDiscounts(settings?.discounts);
    if (error || !tiers) return { total: 0, subtotal, discountAmount: 0, cartSnapshot, couponId: null, error: "Não foi possível validar o desconto do combo. Tente novamente." };
    for (const group of comboGroups.values()) {
      comboDiscountAmount += Math.round(group.subtotal * discountForCount(group.products.size, tiers) / 100);
    }
  }

  let couponDiscountAmount = 0;
  let discountSource: DiscountSource = comboDiscountAmount > 0 ? "combo" : "none";
  if (comboDiscountAmount > 0) {
    discountAmount = comboDiscountAmount;
    total = Math.max(0, subtotal - comboDiscountAmount);
  }

  if (couponId) {
    const { data: coupon, error: couponError } = await supabaseAdmin
      .from("coupons")
      .select("id, active, expires_at, max_uses, current_uses, min_order_value, discount_type, discount_value, origin, metadata")
      .eq("id", couponId)
      .eq("active", true)
      .maybeSingle();

    if (couponError || !coupon) {
      return { total: 0, subtotal, discountAmount: 0, cartSnapshot, couponId: null, error: "Cupom inválido ou inativo" };
    }
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= Date.now()) {
      return { total: 0, subtotal, discountAmount: 0, cartSnapshot, couponId: null, error: "Cupom expirado" };
    }
    if (subtotal < Math.round(Number(coupon.min_order_value || 0) * 100)) {
      return { total: 0, subtotal, discountAmount: 0, cartSnapshot, couponId: null, error: "Valor mínimo do cupom não atingido" };
    }

    const scopeResults = await Promise.all([
      supabaseAdmin.from("coupon_users").select("user_id").eq("coupon_id", coupon.id),
      supabaseAdmin.from("coupon_products").select("product_id").eq("coupon_id", coupon.id),
      supabaseAdmin.from("coupon_usage").select("id").eq("coupon_id", coupon.id).eq("user_id", userId).limit(1),
      supabaseAdmin.from("coupon_usage").select("id", { count: "exact", head: true }).eq("coupon_id", coupon.id),
    ]);

    if(scopeResults.some(result=>result.error)) {
      return {total:0,subtotal,discountAmount:0,cartSnapshot,couponId:null,error:"Não foi possível validar as regras do cupom. Tente novamente."};
    }
    const [{data:allowedUsers},{data:allowedProducts},{data:usage},{count:totalUses}]=scopeResults;

    // Treat the immutable usage ledger as the source of truth instead of trusting
    // coupons.current_uses, which can drift after a failed/old client-side flow.
    if (coupon.max_uses !== null && Number(totalUses || 0) >= Number(coupon.max_uses)) {
      return { total: 0, subtotal, discountAmount: 0, cartSnapshot, couponId: null, error: "Cupom esgotado" };
    }

    if (allowedUsers?.length && !allowedUsers.some((row: any) => row.user_id === userId)) {
      return { total: 0, subtotal, discountAmount: 0, cartSnapshot, couponId: null, error: "Cupom não disponível para este usuário" };
    }
    // Coupon scope is human-configured in Coupon Manager. Technical IDs stay internal.
    // Legacy coupons without scope metadata keep the historical coupon_products behavior.
    let couponBaseCents = subtotal;
    const scopeMode = String(coupon?.metadata?.scope_mode || "");
    const allowedPlanId = coupon?.metadata?.allowed_plan_id ? String(coupon.metadata.allowed_plan_id) : "";
    const lineTotal = (item: any) => {
      if(allowedPlanId && String(item.planId || "") !== allowedPlanId) return 0;
      const unitCents = Math.round(Number(item.price || 0) * 100);
      const quantity = Math.max(1, Number(item.quantity || 1));
      return Number.isFinite(unitCents) ? unitCents * quantity : 0;
    };

    couponBaseCents = cartSnapshot.reduce((sum,item)=>sum+lineTotal(item),0);

    if (scopeMode === "exclude") {
      const excludedIds = new Set(
        Array.isArray(coupon?.metadata?.excluded_product_ids)
          ? coupon.metadata.excluded_product_ids.map((id: unknown) => String(id))
          : []
      );
      couponBaseCents = cartSnapshot.reduce(
        (sum, item) => excludedIds.has(String(item.productId || "")) ? sum : sum + lineTotal(item),
        0
      );
    } else if (scopeMode === "categories") {
      const categoryIds = Array.isArray(coupon?.metadata?.category_ids)
        ? coupon.metadata.category_ids.map((id: unknown) => String(id)).filter(Boolean)
        : [];
      if (!categoryIds.length) {
        couponBaseCents = 0;
      } else {
        const { data: categoryProducts, error: categoryProductsError } = await supabaseAdmin
          .from("products")
          .select("id")
          .in("game_id", categoryIds);
        if (categoryProductsError) {
          return { total: 0, subtotal, discountAmount: 0, cartSnapshot, couponId: null, error: "Não foi possível validar as categorias deste cupom" };
        }
        const categoryProductIds = new Set((categoryProducts || []).map((row: any) => String(row.id)));
        couponBaseCents = cartSnapshot.reduce(
          (sum, item) => categoryProductIds.has(String(item.productId || "")) ? sum + lineTotal(item) : sum,
          0
        );
      }
    } else if (scopeMode === "selected" || (scopeMode !== "all" && allowedProducts?.length)) {
      const allowedIds = new Set((allowedProducts || []).map((row: any) => String(row.product_id)));
      couponBaseCents = cartSnapshot.reduce(
        (sum, item) => allowedIds.has(String(item.productId || "")) ? sum + lineTotal(item) : sum,
        0
      );
    }

    if (couponBaseCents <= 0) {
      return { total: 0, subtotal, discountAmount: 0, cartSnapshot, couponId: null, error: "Cupom não aplicável aos produtos deste carrinho" };
    }
    if (usage?.length) {
      return { total: 0, subtotal, discountAmount: 0, cartSnapshot, couponId: null, error: "Cupom já utilizado" };
    }

    if (coupon.discount_type === "percentage") {
      const percentage = Math.max(0, Math.min(100, Number(coupon.discount_value || 0)));
      couponDiscountAmount = Math.round(couponBaseCents * (percentage / 100));
    } else if (coupon.discount_type === "fixed") {
      couponDiscountAmount = Math.min(couponBaseCents, Math.round(Number(coupon.discount_value || 0) * 100));
    } else {
      return { total: 0, subtotal, discountAmount: 0, cartSnapshot, couponId: null, error: "Tipo de cupom inválido" };
    }

    if (couponDiscountAmount > comboDiscountAmount) {
      discountAmount = couponDiscountAmount;
      total = Math.max(0, subtotal - couponDiscountAmount);
      validatedCouponId = coupon.id;
      discountSource = "coupon";
    } else {
      discountAmount = comboDiscountAmount;
      total = Math.max(0, subtotal - comboDiscountAmount);
      validatedCouponId = null;
      discountSource = comboDiscountAmount > 0 ? "combo" : "none";
    }
  }

  return {
    total: Math.round(total),
    subtotal,
    discountAmount,
    cartSnapshot,
    couponId: validatedCouponId,
    comboDiscountAmount,
    couponDiscountAmount,
    discountSource,
  };
}


function proofHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacCheckout(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return proofHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function safeEqual(left: string, right: string) {
  if (!left || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export function stripCheckoutProof(cart: any[]) {
  return (Array.isArray(cart) ? cart : []).map((item) => {
    if (!item || typeof item !== "object") return item;
    const { _checkoutProof, _checkoutVersion, ...rest } = item;
    return rest;
  });
}

function checkoutProofPayload(args: {
  paymentId: string;
  chargeId: string;
  userId: string;
  totalCents: number;
  couponId: string | null;
  discountCents: number;
  cartSnapshot: any[];
}) {
  return JSON.stringify({
    v: 1,
    paymentId: args.paymentId,
    chargeId: args.chargeId,
    userId: args.userId,
    totalCents: Math.round(args.totalCents),
    couponId: args.couponId || null,
    discountCents: Math.round(args.discountCents || 0),
    cartSnapshot: stripCheckoutProof(args.cartSnapshot),
  });
}

/** Bind a server-built checkout to one internal payment row and one provider transaction. */
export async function attachCheckoutProof(
  secret: string,
  args: {
    paymentId: string;
    chargeId: string;
    userId: string;
    totalCents: number;
    couponId: string | null;
    discountCents: number;
    cartSnapshot: any[];
  },
) {
  if (!secret) throw new Error("CHECKOUT_SIGNING_SECRET is required");
  const clean = stripCheckoutProof(args.cartSnapshot);
  if (!clean.length) throw new Error("Cannot sign an empty checkout");
  const signature = await hmacCheckout(secret, checkoutProofPayload({ ...args, cartSnapshot: clean }));
  return clean.map((item, index) => index === 0 ? { ...item, _checkoutVersion: 1, _checkoutProof: signature } : item);
}

export async function verifyCheckoutProof(secret: string, payment: any) {
  if (!secret || !payment?.id || !payment?.charge_id || !Array.isArray(payment?.cart_snapshot) || !payment.cart_snapshot.length) {
    return { valid: false as const, cartSnapshot: [] as any[] };
  }
  const supplied = String(payment.cart_snapshot[0]?._checkoutProof || "");
  if (!supplied) return { valid: false as const, cartSnapshot: stripCheckoutProof(payment.cart_snapshot) };

  const cartSnapshot = stripCheckoutProof(payment.cart_snapshot);
  const expected = await hmacCheckout(secret, checkoutProofPayload({
    paymentId: String(payment.id),
    chargeId: String(payment.charge_id),
    userId: String(payment.user_id),
    totalCents: Number(payment.amount),
    couponId: payment.coupon_id || null,
    discountCents: Math.round(Number(payment.discount_amount || 0) * 100),
    cartSnapshot,
  }));

  return { valid: safeEqual(supplied.toLowerCase(), expected.toLowerCase()), cartSnapshot };
}

export async function recomputeExpectedPayment(supabaseAdmin: any, payment: any) {
  return calculateServerTotal(
    supabaseAdmin,
    Array.isArray(payment.cart_snapshot) ? payment.cart_snapshot : [],
    payment.coupon_id || null,
    payment.user_id,
  );
}

// Helper: fulfill order (deliver stock, create tickets, record coupon)
export async function fulfillOrder(supabaseAdmin: any, payment: any) {
  const cartItems = payment.cart_snapshot as Array<{
    productId: string;
    planId: string;
    productName: string;
    planName: string;
    price: number;
    resellerDiscountPercent?: number;
    quantity: number;
    type?: string;
    campaignSlug?: string;
    lztItemId?: string;
    lztPrice?: number;
    lztCurrency?: string;
  }>;

  // Check if buyer is a reseller
  const { data: resellerData } = await supabaseAdmin
    .from("resellers")
    .select("id, discount_percent, total_purchases, expires_at")
    .eq("user_id", payment.user_id)
    .eq("active", true)
    .maybeSingle();

  const activeFulfillmentReseller =
    resellerData && (!resellerData.expires_at || new Date(resellerData.expires_at).getTime() > Date.now())
      ? resellerData
      : null;

  for (let itemIndex = 0; itemIndex < cartItems.length; itemIndex++) {
    const item = cartItems[itemIndex];

    // A paid CRAZZY LUCK attempt is fulfilled by play_luck() after this payment reaches
    // COMPLETED. It never creates a product ticket, consumes a key or earns reseller credit.
    if (item.type === "luck-play") continue;

    // Handle LZT Market accounts (check type or planId fallback)
    const isLztAccount = item.type === "lzt-account" || item.planId === "lzt-account";
    if (isLztAccount) {
      // Extract lztItemId from productId if not in the snapshot (e.g. "lzt-216971233" -> "216971233")
      const lztItemId = item.lztItemId || item.productId?.replace("lzt-", "") || "";
      if (lztItemId) {
        await fulfillLztAccount(supabaseAdmin, payment, { ...item, lztItemId });
      } else {
        console.error("LZT account item missing lztItemId:", item);
      }
      continue;
    }

    // Regular product fulfillment
    let originalPrice = item.price || 0;
    if (activeFulfillmentReseller && Number(item.resellerDiscountPercent || 0) > 0) {
      const { data: planData } = await supabaseAdmin
        .from("product_plans")
        .select("price")
        .eq("id", item.planId)
        .single();
      if (planData) originalPrice = Number(planData.price);
    }

    for (let i = 0; i < (item.quantity || 1); i++) {
      // One database RPC atomically binds this paid cart unit to one ticket and, when
      // stock exists, claims exactly one key with FOR UPDATE SKIP LOCKED. Replaying a
      // webhook or polling request returns the existing ticket instead of consuming
      // another key.
      const { data: deliveryRows, error: deliveryError } = await supabaseAdmin.rpc("claim_paid_delivery", {
        p_payment_id: payment.id,
        p_user_id: payment.user_id,
        p_product_id: item.productId,
        p_product_plan_id: item.planId,
        p_item_index: itemIndex,
        p_unit_index: i,
      });

      const delivery = Array.isArray(deliveryRows) ? deliveryRows[0] : deliveryRows;
      if (deliveryError || !delivery?.ticket_id) {
        throw new Error(`Falha ao criar entrega idempotente: ${deliveryError?.message || "ticket ausente"}`);
      }

      const ticket = { id: delivery.ticket_id as string };
      const stockId = (delivery.stock_item_id || null) as string | null;
      const deliveryCreated = delivery.created === true;

      // CRAZZY BONUS is independently idempotent by payment/item/unit. Run this even
      // on a delivery retry so a transient bonus error can heal without duplicating credit.
      const { error: bonusGrantError } = await supabaseAdmin.rpc("grant_purchase_bonus", {
        p_user_id: payment.user_id,
        p_plan_id: item.planId,
        p_payment_id: payment.id,
        p_item_index: itemIndex,
        p_unit_index: i,
      });
      if (bonusGrantError) {
        console.warn("[checkout] CRAZZY BONUS grant skipped", bonusGrantError.message || bonusGrantError);
      }

      // A previous attempt may have delivered this exact unit and then failed later in
      // the fulfillment pipeline. Ticket messages and reseller accounting remain one-shot.
      if (!deliveryCreated) continue;

      if (stockId) {
        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: ticket.id,
          sender_id: payment.user_id,
          sender_role: "staff",
          message: "✅ Seu produto foi entregue automaticamente! Abra sua Biblioteca CRAZZY para revelar a entrega com segurança.",
        });

        const { data: productData } = await supabaseAdmin
          .from("products")
          .select("tutorial_text, tutorial_file_url")
          .eq("id", item.productId)
          .single();

        if (productData?.tutorial_text || productData?.tutorial_file_url) {
          await supabaseAdmin.from("ticket_messages").insert({
            ticket_id: ticket.id,
            sender_id: payment.user_id,
            sender_role: "staff",
            message: "📖 Tutorial associado ao produto. O acesso protegido ficará disponível na CRAZZY ACADEMY.",
          });
        }
      } else if (!stockId) {
        // No stock — notify customer and flag for manual delivery
        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: ticket.id,
          sender_id: payment.user_id,
          sender_role: "staff",
          message: `✅ **Pagamento confirmado!**\n\nSeu produto está sendo preparado e será entregue aqui neste chat em breve pela nossa equipe.\n\nSe tiver alguma dúvida, pode perguntar aqui mesmo.`,
        });
        // Staff note
        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: ticket.id,
          sender_id: payment.user_id,
          sender_role: "staff",
          message: `🔧 **[STAFF - ENTREGA MANUAL NECESSÁRIA]**\n\nO produto **${item.productName}** (plano: ${item.planName}) não tem estoque disponível no momento.\n\n**Valor pago pelo cliente:** R$ ${Number(item.price || 0).toFixed(2)}\n\nPor favor, adicione o estoque e entregue a chave aqui no ticket.`,
        });
      }

      if (activeFulfillmentReseller && Number(item.resellerDiscountPercent || 0) > 0) {
        const { error: resellerLedgerError } = await supabaseAdmin.from("reseller_purchases").insert({
          reseller_id: activeFulfillmentReseller.id,
          product_plan_id: item.planId,
          stock_item_id: stockId,
          original_price: originalPrice,
          paid_price: item.price || 0,
          payment_id: payment.id,
          payment_item_index: itemIndex,
          payment_unit_index: i,
        });
        if (resellerLedgerError && resellerLedgerError.code !== "23505") {
          console.error("[checkout] reseller ledger insert failed", resellerLedgerError.code);
        }
      }
    }
  }

  // Record coupon usage
  if (payment.coupon_id) {
    const { error: usageError } = await supabaseAdmin
      .from("coupon_usage")
      .insert({ coupon_id: payment.coupon_id, user_id: payment.user_id });

    if (usageError) {
      // With the hardening migration applied, a unique (coupon_id,user_id) index
      // turns duplicate delivery retries into a harmless ledger conflict.
      console.warn("[checkout] coupon usage was not inserted", usageError.message || usageError);
    } else {
      const { count } = await supabaseAdmin
        .from("coupon_usage")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", payment.coupon_id);
      if (typeof count === "number") {
        await supabaseAdmin.from("coupons").update({ current_uses: count }).eq("id", payment.coupon_id);
      }
    }
  }
}

// LZT Market account purchase and delivery
async function fulfillLztAccount(supabaseAdmin: any, payment: any, item: any) {
  // Double-check the feature gate at fulfillment time too. A cart snapshot created
  // while the feature was enabled must not spend provider funds after an operator
  // disables the integration during an incident.
  if (Deno.env.get("ENABLE_LZT_AUTO_BUY") !== "true") {
    throw new Error("LZT automatic fulfillment is disabled");
  }

  const LZT_TOKEN = Deno.env.get("LZT_MARKET_TOKEN");
  if (!LZT_TOKEN) {
    throw new Error("LZT_MARKET_TOKEN not configured for account purchase");
  }

  const itemId = item.lztItemId;
  let price = item.lztPrice;
  let currency = item.lztCurrency || "rub";

  // If price is missing, fetch current price from LZT API
  if (!price) {
    console.log(`Fetching current price for LZT item ${itemId}...`);
    const detailRes = await fetch(`https://api.lzt.market/${encodeURIComponent(itemId)}`, {
      headers: { Authorization: `Bearer ${LZT_TOKEN}`, Accept: "application/json" },
    });
    if (detailRes.ok) {
      const detailData = await detailRes.json();
      price = detailData.item?.price;
      currency = detailData.item?.price_currency || currency;
      console.log(`Got price: ${price} ${currency}`);
    }
  }

  if (!price) {
    throw new Error(`Cannot purchase LZT item ${itemId}: no price available`);
  }

  console.log(`Purchasing LZT account ${itemId} at price ${price} ${currency}`);

  try {
    // Fast-buy the account on LZT Market
    const buyUrl = `https://api.lzt.market/${encodeURIComponent(itemId)}/fast-buy?price=${encodeURIComponent(price)}${currency ? `&currency=${encodeURIComponent(currency)}` : ""}`;

    const buyRes = await fetch(buyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LZT_TOKEN}`,
        Accept: "application/json",
      },
    });

    const buyData = await buyRes.json();
    console.log("LZT fast-buy result", { status: buyRes.status, itemId });

    // We need a product + plan in the DB for the ticket system
    // Use a generic "LZT Accounts" product or create ticket without foreign keys
    // For now, we'll find or skip product references and deliver via messages

    // Extract account credentials from the buy response
    let email = "";
    let password = "";
    let rawCredentials = "";
    let accountEmail = "";

    if (buyRes.ok && buyData.item) {
      const boughtItem = buyData.item;
      const loginData = boughtItem.loginData;

      if (loginData) {
        email = loginData.login || loginData.email || "";
        password = loginData.password || "";
        rawCredentials = loginData.raw || "";

        // If no separate fields, try to parse raw (format: login:password)
        if (!email && rawCredentials) {
          const parts = rawCredentials.split(":");
          if (parts.length >= 2) {
            email = parts[0];
            password = parts.slice(1).join(":");
          }
        }
      }

      // Fallback to item-level fields
      if (!email && boughtItem.email) email = boughtItem.email;
      if (!password && boughtItem.password) password = boughtItem.password;

      // Extract actual account email (auto-registered email)
      accountEmail = loginData?.email || boughtItem.email || boughtItem.emailLoginData || "";
      // If accountEmail equals login (username), try to find a real email elsewhere
      if (accountEmail === email && boughtItem.item_origin === "autoreg") {
        accountEmail = boughtItem.email || loginData?.email || "";
      }
    }

    // Build stock content (compact credentials)
    const stockContent = email && password
      ? `Email: ${email}\nSenha: ${password}`
      : rawCredentials
        ? rawCredentials
        : buyRes.ok
          ? `Conta #${itemId} - entrega manual pendente`
          : `Erro na compra #${itemId}`;

    // Use productId and planId directly from the cart item snapshot
    // This ensures the ticket is linked to the correct LZT product, not a random fallback
    const productId: string | null = item.productId?.startsWith("lzt-") ? null : item.productId || null;
    const planId: string | null = item.planId === "lzt-account" ? null : item.planId || null;

    // If productId is an lzt-prefixed ID or missing, find any active product as anchor
    // but only use it structurally — the real name comes from lztMetadata.account_name
    let resolvedProductId = productId;
    let resolvedPlanId = planId;

    if (!resolvedProductId) {
      // Try to find a dedicated LZT/Contas product first
      const { data: lztProduct } = await supabaseAdmin
        .from("products")
        .select("id")
        .ilike("name", "%conta%")
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      if (lztProduct) {
        resolvedProductId = lztProduct.id;
      } else {
        // Last resort: any active product
        const { data: fallback } = await supabaseAdmin
          .from("products")
          .select("id")
          .eq("active", true)
          .limit(1)
          .maybeSingle();
        resolvedProductId = fallback?.id || null;
      }
    }

    if (resolvedProductId && !resolvedPlanId) {
      const { data: plan } = await supabaseAdmin
        .from("product_plans")
        .select("id")
        .eq("product_id", resolvedProductId)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      resolvedPlanId = plan?.id || null;
    }

    if (!resolvedProductId || !resolvedPlanId) {
      throw new Error("No product/plan found for LZT account ticket");
    }

    // Create stock item
    const { data: stockItem } = await supabaseAdmin
      .from("stock_items")
      .insert({
        product_plan_id: resolvedPlanId,
        content: stockContent,
        used: true,
        used_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    // Create order ticket with LZT metadata
    const lztMetadata = {
      type: "lzt-account",
      lzt_item_id: itemId,
      account_name: item.productName || `Conta Valorant #${itemId}`,
      account_image: item.productImage || null,
      price_paid: item.price || price,
      currency: currency,
      skins_count: item.skinsCount || null,
    };

    const { data: ticket } = await supabaseAdmin
      .from("order_tickets")
      .insert({
        user_id: payment.user_id,
        product_id: resolvedProductId,
        product_plan_id: resolvedPlanId,
        stock_item_id: stockItem?.id || null,
        status: buyRes.ok ? "delivered" : "open",
        status_label: buyRes.ok ? "Entregue" : "Aguardando Suporte",
        metadata: { ...lztMetadata, payment_id: payment.id },
      })
      .select("id")
      .single();

    if (ticket && buyRes.ok && email) {
      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: "✅ Conta entregue com segurança. As credenciais ficam disponíveis somente na sua Biblioteca CRAZZY.",
      });

    } else if (ticket && !buyRes.ok) {
      // Notify customer (sem expor LZT ou detalhes técnicos)
      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: `✅ **Pagamento confirmado!**\n\nPara essa conta o envio é manual. Este é o ID do seu pedido: #${itemId}\n\nNossa equipe irá entregar as credenciais aqui neste chat em breve. Se tiver alguma dúvida, pode perguntar aqui mesmo.`,
      });
      // Nota interna para staff (sem expor LZT nem erro técnico ao cliente)
      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: `🔧 **[STAFF - ENTREGA MANUAL NECESSÁRIA]**\n\nPara essa conta o envio é manual.\n\n**ID do pedido:** #${itemId}\n**Conta solicitada:** ${item.productName || `#${itemId}`}\n**Valor pago pelo cliente:** R$ ${Number(item.price || 0).toFixed(2)}\n\nPor favor, processe manualmente e entregue as credenciais aqui.`,
      });
    } else if (ticket && buyRes.ok && !email) {
      // The provider purchase succeeded but its credential shape was not recognized.
      // Never dump the raw provider payload to a customer ticket or logs; route it to
      // manual support instead so sensitive provider metadata stays server-side.
      await supabaseAdmin.from("order_tickets").update({
        status: "open",
        status_label: "Aguardando Suporte",
      }).eq("id", ticket.id);
      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: payment.user_id,
        sender_role: "staff",
        message: `✅ **Pagamento confirmado!**\n\nA conta #${itemId} foi reservada, mas a entrega automática precisa de conferência da equipe. As credenciais serão enviadas aqui no ticket.`,
      });
    }

  } catch (err) {
    console.error("LZT account purchase error:", err);
    throw err;
  }
}

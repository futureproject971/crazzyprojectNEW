const project = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const rest = project + "/rest/v1";
const functions = project + "/functions/v1";
const key = "sb_publishable_Gu8G1uqggVf2pvVenX7EPQ_yIi5t2Kb";
const zero = "00000000-0000-4000-8000-000000000000";

async function req(path, init = {}) {
  return fetch(rest + path, {
    ...init,
    headers: {
      apikey: key,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
}

for (const [name, body] of [
  ["get_payments_manager", {
    p_query: null,
    p_status: null,
    p_method: null,
    p_limit: 10,
    p_offset: 0,
  }],
  ["get_payment_manager_detail", { p_payment_id: zero }],
  ["request_payment_reconciliation", {
    p_payment_id: zero,
    p_reason: "anon smoke",
  }],
  ["set_payment_method_enabled", {
    p_method: "pix",
    p_enabled: true,
  }],
]) {
  const response = await req("/rpc/" + name, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (response.ok) {
    throw new Error(name + " must not be executable by anonymous users");
  }

  console.log("[PASS] " + name + " blocks anonymous access (" + response.status + ")");
}

for (const table of [
  "payment_events",
  "payment_reconcile_requests",
  "payment_refunds",
  "payment_disputes",
  "payment_dispute_evidence",
]) {
  const response = await req("/" + table + "?select=*&limit=1");
  if (response.ok) {
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length > 0) {
      throw new Error("Anonymous user can read " + table);
    }
  }
  console.log("[PASS] " + table + " exposes no anonymous operational rows");
}

const edgeResponse = await fetch(
  functions + "/purincash-payment?action=admin-reconcile",
  {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payment_id: zero }),
    signal: AbortSignal.timeout(15000),
  }
);

if (edgeResponse.ok || ![401, 403].includes(edgeResponse.status)) {
  throw new Error(
    "admin-reconcile must reject anonymous callers, got " + edgeResponse.status
  );
}
console.log("[PASS] PurinCash admin-reconcile blocks anonymous access (" + edgeResponse.status + ")");

const { readFile } = await import("node:fs/promises");

const migration = await readFile(
  "supabase/migrations/202609221730_m29_payments_manager.sql",
  "utf8"
);

for (const required of [
  "payment_events",
  "payment_reconcile_requests",
  "payment_refunds",
  "payment_disputes",
  "get_payments_manager",
  "get_payment_manager_detail",
  "request_payment_reconciliation",
  "set_payment_method_enabled",
  "security invoker",
]) {
  if (!migration.toLowerCase().includes(required.toLowerCase())) {
    throw new Error("M29 migration missing " + required);
  }
}
console.log("[PASS] M29 operational read model and admin RPCs are present");

const api = await readFile("src/app/api/admin/payments/route.ts", "utf8");
for (const required of [
  "get_payments_manager",
  "get_payment_manager_detail",
  "request_payment_reconciliation",
  "admin-reconcile",
  "register_refund_case",
  "register_dispute",
  "add_evidence",
  "providerActionExecuted: false",
]) {
  if (!api.includes(required)) {
    throw new Error("Payments admin API missing " + required);
  }
}

if (/purincash[^\n]{0,100}refund/i.test(api) || /\/refunds?["']/i.test(api)) {
  throw new Error("Refund case registration must not call a provider refund endpoint");
}
console.log("[PASS] refund workflow records a case without moving provider funds");

const edge = await readFile(
  "supabase/functions/purincash-payment/index.ts",
  "utf8"
);

for (const required of [
  'action === "admin-reconcile"',
  'rpc("is_current_admin")',
  "providerKindFromPayment",
  "recordPaymentEvent",
  "reconcile.completed",
  "reconcile.amount_mismatch",
  "PAID_UNSAFE_INTERNAL_STATUS",
]) {
  if (!edge.includes(required)) {
    throw new Error("PurinCash reconciliation flow missing " + required);
  }
}

for (const forbidden of [
  "return json(providerData",
  "return json({ providerData",
  "checkout_payload:",
  "_checkoutProof:",
]) {
  if (edge.includes(forbidden)) {
    throw new Error("Reconciliation must not expose provider/checkout secret payload: " + forbidden);
  }
}
console.log("[PASS] reconciliation uses safe provider verification without returning raw provider payloads");

const page = await readFile(
  "src/modules/payments-manager/PaymentsManagerPage.tsx",
  "utf8"
);
if (!page.includes("Checkout proof, QR payload, API key, webhook secret")) {
  throw new Error("Payments UI must keep the secret-data boundary explicit");
}
if (page.includes("qrCodeImage") || page.includes("_checkoutProof")) {
  throw new Error("Payments UI must not render checkout secret material");
}
console.log("[PASS] Payments Manager UI does not render checkout secrets");

const nav = await readFile("src/core/app-shell/navigation.ts", "utf8");
if (!nav.includes('href: "/admin/pagamentos"')) {
  throw new Error("Admin payments navigation must point to /admin/pagamentos");
}
console.log("[PASS] admin navigation points to Payments Manager");

console.log("[PASS] M29 CRAZZY PAYMENTS MANAGER security smoke");

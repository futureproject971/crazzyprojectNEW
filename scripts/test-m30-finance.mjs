const project = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const rest = project + "/rest/v1";
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
  ["get_finance_manager", {
    p_from: null,
    p_to: null,
    p_method: null,
  }],
  ["set_finance_fee_rule", {
    p_method: "pix",
    p_percent_bps: 100,
    p_fixed_cents: 0,
    p_source_label: "anon",
    p_notes: null,
  }],
  ["clear_finance_fee_rule", { p_method: "pix" }],
  ["set_payment_finance_cost", {
    p_payment_id: zero,
    p_gateway_fee_cents: 0,
    p_provider_net_cents: null,
    p_source: "manual",
    p_note: null,
  }],
  ["create_finance_hold", {
    p_amount_cents: 100,
    p_reason: "anon",
    p_payment_id: null,
    p_provider_ref: null,
  }],
  ["set_finance_hold_status", {
    p_hold_id: zero,
    p_status: "released",
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
  "finance_fee_rules",
  "finance_payment_costs",
  "finance_holds",
]) {
  const response = await req("/" + table + "?select=*&limit=1");
  if (response.ok) {
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length > 0) {
      throw new Error("Anonymous user can read " + table);
    }
  }
  console.log("[PASS] " + table + " exposes no anonymous finance rows");
}

const { readFile } = await import("node:fs/promises");

const migration = await readFile(
  "supabase/migrations/202609221900_m30_finance.sql",
  "utf8"
);

for (const required of [
  "finance_fee_rules",
  "finance_payment_costs",
  "finance_holds",
  "get_finance_manager",
  "set_finance_fee_rule",
  "set_payment_finance_cost",
  "create_finance_hold",
  "security invoker",
  "unpriced_payments",
  "net_estimated_cents",
]) {
  if (!migration.toLowerCase().includes(required.toLowerCase())) {
    throw new Error("M30 migration missing " + required);
  }
}

for (const forbiddenSeed of [
  "insert into public.finance_fee_rules",
  "values('pix'",
  "values ('pix'",
  "0.50",
  "1.99",
]) {
  if (migration.toLowerCase().includes(forbiddenSeed.toLowerCase())) {
    throw new Error(
      "Finance migration must not seed invented gateway pricing: " + forbiddenSeed
    );
  }
}
console.log("[PASS] M30 does not seed or invent PurinCash fee values");

const api = await readFile("src/app/api/admin/finance/route.ts", "utf8");
for (const required of [
  "get_finance_manager",
  "set_finance_fee_rule",
  "clear_finance_fee_rule",
  "set_payment_finance_cost",
  "create_finance_hold",
  "set_finance_hold_status",
]) {
  if (!api.includes(required)) {
    throw new Error("Finance API missing " + required);
  }
}
console.log("[PASS] Finance API exposes only explicit admin operations");

const page = await readFile(
  "src/modules/finance-manager/FinanceManagerPage.tsx",
  "utf8"
);

for (const required of [
  "RESULTADO LÍQUIDO AINDA NÃO É DEFINITIVO",
  "NÃO PRECIFICADA",
  "REGRA ESTIMADA",
  "Definir real",
  "Retenções e disputas abertas são",
]) {
  if (!page.includes(required)) {
    throw new Error("Finance UI missing transparency control: " + required);
  }
}

if (
  page.includes("PurinCash 0,50") ||
  page.includes("PurinCash 1,99") ||
  page.includes("taxa oficial")
) {
  throw new Error("Finance UI must not hardcode an unverified provider fee");
}
console.log("[PASS] Finance UI distinguishes actual, estimated and unknown fees");

const nav = await readFile("src/core/app-shell/navigation.ts", "utf8");
if (!nav.includes('href: "/admin/finance"')) {
  throw new Error("Finance Manager must be linked in admin navigation");
}
console.log("[PASS] Finance Manager is linked in admin navigation");

console.log("[PASS] M30 CRAZZY FINANCE security/transparency smoke");

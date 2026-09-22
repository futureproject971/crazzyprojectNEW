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

const adminChecks = [
  ["get_stock_manager_catalog", "/rpc/get_stock_manager_catalog", {}],
  ["get_stock_manager_items", "/rpc/get_stock_manager_items", {
    p_product_plan_id: zero,
    p_limit: 10,
    p_offset: 0,
  }],
  ["import_stock_batch", "/rpc/import_stock_batch", {
    p_product_plan_id: zero,
    p_items: ["ANON-KEY"],
    p_source: "anon",
    p_note: null,
  }],
  ["set_stock_item_disabled", "/rpc/set_stock_item_disabled", {
    p_stock_item_id: zero,
    p_disabled: true,
    p_reason: "anon",
  }],
];

for (const [name, path, body] of adminChecks) {
  const response = await req(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (response.ok) {
    throw new Error(name + " must not be executable by anonymous users");
  }
  console.log("[PASS] " + name + " blocks anonymous access (" + response.status + ")");
}

const serviceChecks = [
  ["reserve_stock_for_fulfillment", "/rpc/reserve_stock_for_fulfillment", {
    p_product_plan_id: zero,
    p_reservation_key: "anonymous-reservation",
    p_ttl_minutes: 15,
  }],
  ["consume_stock_reservation", "/rpc/consume_stock_reservation", {
    p_reservation_id: zero,
    p_reservation_key: "anonymous-reservation",
  }],
  ["release_stock_reservation", "/rpc/release_stock_reservation", {
    p_reservation_id: zero,
    p_reservation_key: "anonymous-reservation",
  }],
];

for (const [name, path, body] of serviceChecks) {
  const response = await req(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (response.ok) {
    throw new Error(name + " must be service-role only");
  }
  console.log("[PASS] " + name + " blocks anonymous access (" + response.status + ")");
}

for (const table of ["stock_items", "stock_batches", "stock_reservations", "stock_events"]) {
  const response = await req("/" + table + "?select=*&limit=1");
  if (response.ok) {
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length > 0) {
      throw new Error("Anonymous user can read " + table);
    }
  }
  console.log("[PASS] " + table + " exposes no anonymous stock rows");
}

const { readFile } = await import("node:fs/promises");
const migration = await readFile(
  "supabase/migrations/202609221550_m27_stock_manager.sql",
  "utf8"
);

for (const required of [
  "content_hash",
  "digest(v_normalized,'sha256')",
  "for update skip locked",
  "reserve_stock_for_fulfillment",
  "consume_stock_reservation",
  "release_stock_reservation",
  "grant execute on function public.consume_stock_reservation(uuid,text) to service_role",
  "si.disabled=false",
]) {
  if (!migration.toLowerCase().includes(required.toLowerCase())) {
    throw new Error("M27 migration missing " + required);
  }
}
console.log("[PASS] M27 duplicate guard, atomic reservation and service-only consume are versioned");

const ui = await readFile("src/modules/stock-manager/StockManagerPage.tsx", "utf8");
if (ui.includes("item.content}") || ui.includes("item.content ")) {
  throw new Error("Stock Manager UI must not render plaintext stock content");
}
if (!ui.includes("masked_content")) {
  throw new Error("Stock Manager UI must use masked stock previews");
}
console.log("[PASS] Stock Manager renders masked key previews only");

console.log("[PASS] M27 CRAZZY STOCK security smoke");

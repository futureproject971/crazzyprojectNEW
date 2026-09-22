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

for (const [name, path, body] of [
  ["get_sales_manager", "/rpc/get_sales_manager", {
    p_query: null,
    p_status: null,
    p_limit: 10,
    p_offset: 0,
  }],
  ["get_sales_manager_detail", "/rpc/get_sales_manager_detail", {
    p_payment_id: zero,
  }],
]) {
  const response = await req(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (response.ok) {
    throw new Error(name + " must not be executable by anonymous users");
  }

  console.log("[PASS] " + name + " blocks anonymous access (" + response.status + ")");
}

for (const table of [
  "payments",
  "order_tickets",
  "entitlements",
  "library_deliveries",
  "discord_role_grants",
]) {
  const response = await req("/" + table + "?select=*&limit=1");
  if (response.ok) {
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length > 0) {
      throw new Error("Anonymous user can read " + table);
    }
  }
  console.log("[PASS] " + table + " exposes no anonymous sales rows");
}

const { readFile } = await import("node:fs/promises");
const migration = await readFile(
  "supabase/migrations/202609221620_m28_sales_manager.sql",
  "utf8"
);

for (const required of [
  "get_sales_manager",
  "get_sales_manager_detail",
  "fulfillment_status",
  "tutorial_unlock_count",
  "discord_status",
  "security invoker",
]) {
  if (!migration.toLowerCase().includes(required.toLowerCase())) {
    throw new Error("M28 migration missing " + required);
  }
}

for (const forbidden of [
  "si.content",
  "stock_items.content",
  "library_delivery_secrets",
  "_checkoutproof",
]) {
  if (migration.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error("M28 read model must not expose secret material: " + forbidden);
  }
}
console.log("[PASS] M28 read model joins delivery state without secret payloads");

const page = await readFile("src/modules/sales-manager/SalesManagerPage.tsx", "utf8");
if (!page.includes("keys e credenciais não são exibidos")) {
  throw new Error("Sales Manager must keep the secret-content boundary explicit");
}
if (page.includes("stock_item.content") || page.includes("delivery.content")) {
  throw new Error("Sales Manager UI must not render delivered secrets");
}
console.log("[PASS] Sales Manager UI does not render delivered credentials");

const surfaces = await readFile(
  "src/core/design-system/styles/card-surfaces.css",
  "utf8"
);
for (const name of [
  "crz-catalog-card__art",
  "crz-account-card__visual",
  "crz-product-gallery__stage",
  "crz-luck-scratch-card",
  "crz-luck-drop-box__body",
]) {
  if (surfaces.includes("." + name + ",") || surfaces.includes("." + name + " {")) {
    throw new Error("Premium card skin must not override media/art surface " + name);
  }
}
console.log("[PASS] premium card skin excludes image/wallpaper/media surfaces");

console.log("[PASS] M28 CRAZZY SALES MANAGER security smoke");

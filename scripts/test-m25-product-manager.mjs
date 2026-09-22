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

const rpcChecks = [
  ["get_product_manager_catalog", "/rpc/get_product_manager_catalog", {}],
  ["create_product_manager_product", "/rpc/create_product_manager_product", {
    p_game_id: zero,
    p_name: "anon",
    p_emoji: null,
    p_accent_color: null,
    p_create_default_plans: false,
  }],
  ["create_product_manager_plan", "/rpc/create_product_manager_plan", {
    p_product_id: zero,
    p_name: "anon",
    p_plan_code: "custom",
    p_price: 0,
  }],
  ["save_product_manager_product", "/rpc/save_product_manager_product", {
    p_product_id: zero,
    p_game_id: zero,
    p_name: "anon",
    p_description: null,
    p_features_text: null,
    p_image_url: null,
    p_is_new: false,
    p_active: false,
    p_sort_order: 0,
    p_status: "undetected",
    p_status_label: "Indetectável",
    p_emoji: null,
    p_accent_color: null,
    p_automation_flags: {},
    p_tutorial_ids: [],
  }],
  ["save_product_manager_plan", "/rpc/save_product_manager_plan", {
    p_plan_id: zero,
    p_name: "anon",
    p_price: 0,
    p_active: false,
    p_sort_order: 0,
    p_plan_code: "custom",
    p_show_when_out_of_stock: false,
    p_emoji: null,
    p_accent_color: null,
    p_delivery_mode: "manual",
    p_discord_role_id: null,
    p_discord_role_name: null,
    p_discord_role_color: null,
    p_discord_role_position: null,
    p_entitlement_duration_minutes: null,
    p_supplier_provider: null,
    p_supplier_product_id: null,
    p_supplier_variation_id: null,
    p_automation_flags: {},
    p_tutorial_ids: [],
  }],
];

for (const [name, path, body] of rpcChecks) {
  const response = await req(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (response.ok) {
    throw new Error(name + " must not be executable by anonymous users");
  }

  console.log("[PASS] " + name + " blocks anonymous access (" + response.status + ")");
}

const publicProducts = await req("/products?select=id,name,active&limit=1");
if (!publicProducts.ok) {
  throw new Error("Public product catalog read must remain available");
}
console.log("[PASS] public product catalog remains readable");

for (const [label, path] of [
  ["supplier mapping", "/product_plans?select=supplier_provider&limit=1"],
  ["product automation", "/products?select=automation_flags&limit=1"],
]) {
  const response = await req(path);
  if (response.ok) {
    throw new Error(label + " must not exist on public REST-readable tables");
  }
  console.log("[PASS] " + label + " is not exposed by public tables");
}

const privateSchema = await req("/product_plan_operations?select=*&limit=1", {
  headers: { "Accept-Profile": "private" },
});
if (privateSchema.ok) {
  throw new Error("private operational schema must not be exposed through Data API");
}
console.log("[PASS] private operational schema is not exposed");

const { readFile } = await import("node:fs/promises");
const migration = await readFile(
  "supabase/migrations/202609221500_m25_product_manager_finalize.sql",
  "utf8"
);

for (const required of [
  "private.product_operations",
  "private.product_plan_operations",
  "security invoker",
  "create_product_manager_product",
  "create_product_manager_plan",
]) {
  if (!migration.includes(required)) {
    throw new Error("M25 finalize migration missing " + required);
  }
}
console.log("[PASS] M25 migration contains private ops and SECURITY INVOKER RPCs");

console.log("[PASS] M25 CRAZZY PRODUCT MANAGER security smoke");

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

const publicCategories = await req("/rpc/get_public_categories", {
  method: "POST",
  body: "{}",
});
if (!publicCategories.ok) {
  throw new Error("Public category directory expected 200, got " + publicCategories.status);
}
const categories = await publicCategories.json();
if (!Array.isArray(categories)) {
  throw new Error("Public category RPC must return an array");
}
for (const category of categories) {
  if (!category.id || !category.name || category.active === false) {
    throw new Error("Public category payload contains invalid or inactive category");
  }
}
console.log("[PASS] public category directory is readable and sanitized");

const managerChecks = [
  ["get_category_manager_catalog", "/rpc/get_category_manager_catalog", {}],
  ["create_category_manager_category", "/rpc/create_category_manager_category", {
    p_name: "Anon",
    p_slug: "anon",
    p_description: null,
    p_image_url: null,
    p_icon_url: null,
    p_emoji: null,
    p_accent_color: null,
  }],
  ["save_category_manager_category", "/rpc/save_category_manager_category", {
    p_category_id: zero,
    p_name: "Anon",
    p_slug: "anon",
    p_description: null,
    p_image_url: null,
    p_icon_url: null,
    p_emoji: null,
    p_accent_color: null,
    p_active: false,
    p_sort_order: 0,
  }],
];

for (const [name, path, body] of managerChecks) {
  const response = await req(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (response.ok) {
    throw new Error(name + " must not be executable by anonymous users");
  }
  console.log("[PASS] " + name + " blocks anonymous access (" + response.status + ")");
}

const directGames = await req("/games?select=id,name,slug,description,icon_url,emoji,accent_color,active,sort_order&limit=2");
if (!directGames.ok) {
  throw new Error("Public games/categories read must remain available");
}
console.log("[PASS] public category fields remain readable");

const { readFile } = await import("node:fs/promises");
const migration = await readFile(
  "supabase/migrations/202609221520_m26_category_manager.sql",
  "utf8"
);
for (const name of [
  "get_public_categories",
  "get_category_manager_catalog",
  "create_category_manager_category",
  "save_category_manager_category",
  "security invoker",
]) {
  if (!migration.includes(name)) {
    throw new Error("M26 migration missing " + name);
  }
}

const route = await readFile("src/app/categorias/page.tsx", "utf8");
if (!route.includes("CategoryDirectoryPage")) {
  throw new Error("/categorias must use the live category directory");
}
console.log("[PASS] /categorias uses live database-backed category directory");

console.log("[PASS] M26 CRAZZY CATEGORY MANAGER smoke");

const base = "https://nnmglkdpmffmaiuwbcct.supabase.co/rest/v1";
const key = "sb_publishable_Gu8G1uqggVf2pvVenX7EPQ_yIi5t2Kb";

async function request(path) {
  return fetch(base + path, {
    headers: {
      apikey: key,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });
}

for (const table of ["entitlements", "discord_role_grants"]) {
  const response = await request("/" + table + "?select=id&limit=1");
  if (response.ok) {
    throw new Error(table + " must not be readable by anon");
  }
  if (![401, 403].includes(response.status)) {
    throw new Error(table + " expected 401/403 for anon, got " + response.status);
  }
  console.log("[PASS] anon blocked from " + table);
}

const products = await request("/products?select=id&limit=1");
if (!products.ok) {
  throw new Error("public products should remain readable, got " + products.status);
}
console.log("[PASS] public catalog remains readable");
console.log("[PASS] M10 client hub RLS smoke");

const project = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const rest = project + "/rest/v1";
const key = "sb_publishable_Gu8G1uqggVf2pvVenX7EPQ_yIi5t2Kb";

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

for (const table of ["coupons", "coupon_users", "coupon_products"]) {
  const response = await req("/" + table + "?select=*&limit=1");
  if (response.ok) {
    throw new Error(table + " must not expose coupon data to anonymous users");
  }
  console.log("[PASS] anon blocked from " + table + " (" + response.status + ")");
}

const mine = await req("/rpc/get_my_coupons", {
  method: "POST",
  body: "{}",
});
if (mine.ok) {
  throw new Error("get_my_coupons must require authentication");
}
console.log("[PASS] coupon wallet RPC requires authentication");

const usage = await req("/coupon_usage?select=*&limit=1");
if (usage.ok) {
  throw new Error("coupon_usage must not expose usage ledger to anonymous users");
}
console.log("[PASS] coupon usage ledger is private");

console.log("[PASS] M19 Coupons security smoke");

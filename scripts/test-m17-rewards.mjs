const project = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const rest = project + "/rest/v1";
const fn = project + "/functions/v1/rewards";
const key = "sb_publishable_Gu8G1uqggVf2pvVenX7EPQ_yIi5t2Kb";

async function restRequest(path, init = {}) {
  return fetch(rest + path, {
    ...init,
    headers: {
      apikey: key,
      Accept: "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
}

for (const table of ["reward_sessions", "reward_deliveries"]) {
  const response = await restRequest("/" + table + "?select=*&limit=1");
  if (response.ok) {
    throw new Error(table + " must not be readable by anon");
  }
  console.log("[PASS] anon blocked from " + table + " (" + response.status + ")");
}

const catalog = await fetch(fn + "?action=catalog", {
  headers: { apikey: key, Accept: "application/json" },
  signal: AbortSignal.timeout(15000),
});
if (!catalog.ok) {
  throw new Error("Reward catalog should be public, got " + catalog.status);
}
console.log("[PASS] reward catalog is public");

const start = await fetch(fn + "?action=start", {
  method: "POST",
  headers: {
    apikey: key,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    campaign_product_id: "00000000-0000-4000-8000-000000000000",
  }),
  signal: AbortSignal.timeout(15000),
});
if (start.status !== 401) {
  throw new Error("Reward start without auth expected 401, got " + start.status);
}
console.log("[PASS] reward start requires authentication");

const history = await fetch(fn + "?action=history", {
  headers: { apikey: key, Accept: "application/json" },
  signal: AbortSignal.timeout(15000),
});
if (![401, 404].includes(history.status)) {
  throw new Error("Reward history without auth expected 401/404, got " + history.status);
}
console.log("[PASS] reward history is not public");

console.log("[PASS] M17 Rewards security smoke");

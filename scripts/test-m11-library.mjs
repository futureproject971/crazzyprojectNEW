const rest = "https://nnmglkdpmffmaiuwbcct.supabase.co/rest/v1";
const fn = "https://nnmglkdpmffmaiuwbcct.supabase.co/functions/v1/library";
const key = "sb_publishable_Gu8G1uqggVf2pvVenX7EPQ_yIi5t2Kb";

async function publicRest(path, extra = {}) {
  return fetch(rest + path, {
    headers: {
      apikey: key,
      Accept: "application/json",
      ...extra,
    },
    signal: AbortSignal.timeout(15000),
  });
}

for (const table of [
  "stock_items",
  "reward_deliveries",
  "library_deliveries",
  "library_reveal_events",
]) {
  const response = await publicRest("/" + table + "?select=*&limit=1");
  if (response.ok) {
    throw new Error(table + " must not be readable by anon");
  }
  console.log("[PASS] anon blocked from " + table + " (" + response.status + ")");
}

const privateSchema = await publicRest("/library_delivery_secrets?select=*&limit=1", {
  "Accept-Profile": "private",
});
if (privateSchema.ok) {
  throw new Error("private library_delivery_secrets must not be exposed");
}
console.log("[PASS] private secret schema is not exposed (" + privateSchema.status + ")");

const snapshot = await fetch(fn + "?action=snapshot", {
  headers: { Accept: "application/json", apikey: key },
  signal: AbortSignal.timeout(15000),
});
if (snapshot.status !== 401) {
  throw new Error("unauthenticated Library snapshot expected 401, got " + snapshot.status);
}
console.log("[PASS] Library snapshot requires authentication");

const reveal = await fetch(fn + "?action=reveal", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: key,
  },
  body: JSON.stringify({ delivery_id: "00000000-0000-0000-0000-000000000000" }),
  signal: AbortSignal.timeout(15000),
});
if (reveal.status !== 401) {
  throw new Error("unauthenticated reveal expected 401, got " + reveal.status);
}
console.log("[PASS] Library reveal requires authentication");

const products = await publicRest("/products?select=id&limit=1");
if (!products.ok) {
  throw new Error("public catalog should remain readable, got " + products.status);
}
console.log("[PASS] public catalog remains readable");
console.log("[PASS] M11 Library security smoke");

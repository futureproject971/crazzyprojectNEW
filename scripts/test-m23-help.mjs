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

const all = await req("/rpc/get_help_content", {
  method: "POST",
  body: JSON.stringify({ p_query: "", p_limit: 60 }),
});
if (!all.ok) throw new Error("Public Help RPC expected 200, got " + all.status);
const result = await all.json();
if (!result || !Array.isArray(result.faqs) || result.faqs.length < 5) {
  throw new Error("Expected seeded public FAQ content");
}
if (!Array.isArray(result.tutorials)) {
  throw new Error("Expected tutorials array");
}
console.log("[PASS] Help returns FAQ + public tutorial search");

const search = await req("/rpc/get_help_content", {
  method: "POST",
  body: JSON.stringify({ p_query: "cupom", p_limit: 20 }),
});
if (!search.ok) throw new Error("Help search expected 200");
const searched = await search.json();
if (!Array.isArray(searched.faqs) || searched.faqs.length === 0) {
  throw new Error("Expected coupon-related FAQ search result");
}
console.log("[PASS] Help search returns relevant FAQ");

const direct = await req("/help_faqs?select=*&limit=1");
if (direct.ok) {
  const rows = await direct.json();
  if (!Array.isArray(rows) || rows.length !== 0) {
    throw new Error("Anonymous direct FAQ table read must expose no rows");
  }
}
console.log("[PASS] direct FAQ table reads expose no rows");

const serialized = JSON.stringify(result).toLowerCase();
for (const internal of ["service_role", "supabase", "lzt", "purincash"]) {
  if (serialized.includes(internal)) {
    throw new Error("Help response leaked internal implementation text: " + internal);
  }
}
console.log("[PASS] Help response is customer-safe");

console.log("[PASS] M23 CRAZZY HELP smoke");

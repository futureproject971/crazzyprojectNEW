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

const tiers = await req("/rank_tiers?select=code,label,min_points,color,tone&active=eq.true&order=min_points.asc");
if (!tiers.ok) throw new Error("Active rank tiers should be readable");
const rows = await tiers.json();
if (!Array.isArray(rows) || rows.length < 2) throw new Error("Expected seeded rank tiers");
console.log("[PASS] public rank tier ladder is readable");

for (const [name, path, body] of [
  ["get_my_rank", "/rpc/get_my_rank", {}],
  ["get_rank_leaderboard", "/rpc/get_rank_leaderboard", { p_limit: 5 }],
  ["get_rank_summaries", "/rpc/get_rank_summaries", { p_user_ids: [] }],
  ["rank_breakdown_for_user", "/rpc/rank_breakdown_for_user", { p_user: "00000000-0000-4000-8000-000000000000" }],
]) {
  const response = await req(path, { method: "POST", body: JSON.stringify(body) });
  if (response.ok) throw new Error(name + " must require the correct server/auth role");
  console.log("[PASS] " + name + " is protected (" + response.status + ")");
}

console.log("[PASS] M20 CRAZZY RANK security smoke");

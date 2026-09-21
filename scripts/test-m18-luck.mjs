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

for (const table of ["luck_plays", "luck_awards"]) {
  const response = await req("/" + table + "?select=*&limit=1");
  if (response.ok) throw new Error(table + " must not be public");
  console.log("[PASS] anon blocked from " + table + " (" + response.status + ")");
}

const catalogResponse = await req("/rpc/get_luck_catalog", {
  method: "POST",
  body: "{}",
});
if (!catalogResponse.ok) {
  throw new Error("Luck catalog expected 200, got " + catalogResponse.status);
}
const campaigns = await catalogResponse.json();
if (!Array.isArray(campaigns) || campaigns.length < 3) {
  throw new Error("Expected wheel, scratch and drop campaigns");
}

for (const campaign of campaigns) {
  if (!["wheel","scratch","drop"].includes(campaign.mode)) throw new Error("Unexpected luck mode");
  if (!Array.isArray(campaign.prizes) || !campaign.prizes.length) throw new Error("Campaign has no prizes");
  const total = campaign.prizes.reduce((sum, prize) => sum + Number(prize.chance_percent || 0), 0);
  if (Math.abs(total - 100) > 0.1) {
    throw new Error("Auditable odds must total 100%, got " + total + " for " + campaign.slug);
  }
}
console.log("[PASS] public luck catalogue exposes auditable 100% odds");

const play = await req("/rpc/play_luck", {
  method: "POST",
  body: JSON.stringify({
    p_campaign_slug: "daily-wheel",
    p_idempotency_key: "anonymous-smoke-test",
    p_payment_id: null,
  }),
});
if (play.ok) throw new Error("Anonymous user must not be able to play");
console.log("[PASS] luck play requires authenticated user");

console.log("[PASS] M18 CRAZZY LUCK security smoke");

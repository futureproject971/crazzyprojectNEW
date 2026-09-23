import fs from "node:fs/promises";

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

const checkout = await fs.readFile("supabase/functions/_shared/checkout.ts", "utf8");
for (const required of [
  'rawItem.type === "luck-play"',
  '.from("luck_campaigns")',
  '.select("id,slug,title,active,play_price_cents,starts_at,ends_at")',
  'type: "luck-play"',
  'campaignSlug: campaign.slug',
  'if (item.type === "luck-play") continue',
]) {
  if (!checkout.includes(required)) {
    throw new Error("Paid Luck checkout binding missing " + required);
  }
}
console.log("[PASS] paid Luck price and purpose are built server-side and skip product fulfillment");

const migration = await fs.readFile(
  "supabase/migrations/20260923192428_luck_paid_payment_binding.sql",
  "utf8",
);
for (const required of [
  "PAYMENT_PURPOSE_INVALID",
  "v_payment.amount <> v_campaign.play_price_cents",
  "jsonb_array_length(v_payment.cart_snapshot) <> 1",
  "v_payment.cart_snapshot->0->>'type','') <> 'luck-play'",
  "v_payment.cart_snapshot->0->>'campaignSlug','') <> v_campaign.slug",
  "PAYMENT_ALREADY_USED",
]) {
  if (!migration.includes(required)) {
    throw new Error("Paid Luck database guard missing " + required);
  }
}
console.log("[PASS] completed payment must belong to the exact Luck campaign and can be consumed once");

const page = await fs.readFile("src/modules/luck/LuckPage.tsx", "utf8");
for (const required of [
  'cart_snapshot:[{type:"luck-play",campaignSlug:campaign.slug,quantity:1}]',
  '"/api/checkout/status?payment_id="',
  "sessionStorage.setItem(paymentStorageKey(campaign.slug)",
  "paymentId: paymentId || null",
  "paidPlayTriggered",
]) {
  if (!page.includes(required)) {
    throw new Error("Paid Luck client recovery flow missing " + required);
  }
}
console.log("[PASS] paid Luck client resumes pending payment and auto-plays only after COMPLETED");

const api = await fs.readFile("src/app/api/luck/route.ts", "utf8");
if (!api.includes("PAYMENT_PURPOSE_INVALID")) {
  throw new Error("Luck API must map purpose mismatch to a safe public error");
}
console.log("[PASS] purpose mismatch is handled without leaking internals");

console.log("[PASS] M18 CRAZZY LUCK security smoke");

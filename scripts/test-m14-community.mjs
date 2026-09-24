const project = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const rest = project + "/rest/v1";
const fn = project + "/functions/v1/community";
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

for (const table of [
  "community_channels",
  "community_messages",
  "community_reactions",
  "community_attachments",
]) {
  const response = await restRequest("/" + table + "?select=*&limit=1");
  if (response.ok) {
    throw new Error(table + " must not be readable by anon");
  }
  console.log("[PASS] anon blocked from " + table + " (" + response.status + ")");
}

const snapshot = await fetch(fn + "?action=snapshot&channel=geral", {
  headers: { apikey: key, Accept: "application/json" },
  signal: AbortSignal.timeout(15000),
});
if (snapshot.status !== 401) {
  throw new Error("Community snapshot without auth expected 401, got " + snapshot.status);
}
console.log("[PASS] Community snapshot requires authentication");

const create = await fetch(fn + "?action=message", {
  method: "POST",
  headers: {
    apikey: key,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    channel: "geral",
    message: "This request must be rejected without a user session.",
  }),
  signal: AbortSignal.timeout(15000),
});
if (create.status !== 401) {
  throw new Error("Community message without auth expected 401, got " + create.status);
}
console.log("[PASS] Community message requires authentication");

const reaction = await fetch(fn + "?action=reaction", {
  method: "POST",
  headers: {
    apikey: key,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message_id: "00000000-0000-4000-8000-000000000000",
    emoji: "🔥",
  }),
  signal: AbortSignal.timeout(15000),
});
if (reaction.status !== 401) {
  throw new Error("Community reaction without auth expected 401, got " + reaction.status);
}
console.log("[PASS] Community reactions require authentication");

const publicMedia = await fetch(
  project + "/storage/v1/object/public/community-media/probe.png",
  {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15000),
  }
);
if (publicMedia.ok) {
  throw new Error("community-media must not be publicly readable");
}
console.log("[PASS] Community media bucket has no public object access");

const products = await restRequest("/products?select=id&limit=1");
if (!products.ok) {
  throw new Error("public catalog should remain readable, got " + products.status);
}
console.log("[PASS] public catalog remains readable");

console.log("[PASS] M14 Community security smoke");


const middleware = await (await import("node:fs/promises")).readFile("src/lib/supabase/middleware.ts","utf8");
for (const required of ['"/comunidade"','"/api/community"',"discord_identities","guild_member"]) {
  if (!middleware.includes(required)) {
    throw new Error("Community Discord/guild gate missing " + required);
  }
}
console.log("[PASS] community page and API namespace require Discord guild membership");

const project = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const rest = project + "/rest/v1";
const fn = project + "/functions/v1/support";
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
  "support_tickets",
  "support_messages",
  "support_attachments",
  "support_ticket_events",
]) {
  const response = await restRequest("/" + table + "?select=*&limit=1");
  if (response.ok) {
    throw new Error(table + " must not be readable by anon");
  }
  console.log("[PASS] anon blocked from " + table + " (" + response.status + ")");
}

const snapshot = await fetch(fn + "?action=snapshot", {
  headers: { apikey: key, Accept: "application/json" },
  signal: AbortSignal.timeout(15000),
});
if (snapshot.status !== 401) {
  throw new Error("Support snapshot without auth expected 401, got " + snapshot.status);
}
console.log("[PASS] Support snapshot requires authentication");

const create = await fetch(fn + "?action=create", {
  method: "POST",
  headers: {
    apikey: key,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    category: "technical",
    subject: "Smoke test",
    message: "This request must be rejected without a user session.",
  }),
  signal: AbortSignal.timeout(15000),
});
if (create.status !== 401) {
  throw new Error("Support create without auth expected 401, got " + create.status);
}
console.log("[PASS] Support create requires authentication");

const publicAttachment = await fetch(
  project + "/storage/v1/object/public/support-attachments/probe.txt",
  {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15000),
  }
);
if (publicAttachment.ok) {
  throw new Error("support-attachments must not be publicly readable");
}
console.log("[PASS] Support bucket has no public object access");

const products = await restRequest("/products?select=id&limit=1");
if (!products.ok) {
  throw new Error("public catalog should remain readable, got " + products.status);
}
console.log("[PASS] public catalog remains readable");

console.log("[PASS] M13 Support security smoke");

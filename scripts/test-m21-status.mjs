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

const response = await req("/rpc/get_public_status", {
  method: "POST",
  body: "{}",
});
if (!response.ok) throw new Error("Public status RPC expected 200, got " + response.status);

const snapshot = await response.json();
if (!snapshot || !Array.isArray(snapshot.components) || snapshot.components.length < 5) {
  throw new Error("Public status should expose the customer-safe service list");
}

const serialized = JSON.stringify(snapshot).toLowerCase();
for (const internalName of ["supabase", "vercel", "lzt", "purincash"]) {
  if (serialized.includes(internalName)) {
    throw new Error("Public status leaked an internal provider name: " + internalName);
  }
}
console.log("[PASS] public status exposes only customer-facing service names");

const writeAttempt = await req("/status_components", {
  method: "POST",
  headers: { Prefer: "return=minimal" },
  body: JSON.stringify({
    key: "client-test",
    label: "Client Test",
    description: "should be denied",
    state: "operational",
  }),
});
if (writeAttempt.ok) throw new Error("Anonymous users must not modify service status");
console.log("[PASS] status configuration is not client-writable");

console.log("[PASS] M21 CRAZZY STATUS security smoke");

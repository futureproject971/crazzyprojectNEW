const base = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const fn = base + "/functions/v1/auth-discord-sync";

const unauthorized = await fetch(fn, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: "sb_publishable_Gu8G1uqggVf2pvVenX7EPQ_yIi5t2Kb",
  },
  body: JSON.stringify({ provider_token: "not-a-real-token" }),
  signal: AbortSignal.timeout(15000),
});

const unauthorizedBody = await unauthorized.json().catch(() => null);
if (unauthorized.status !== 401 || unauthorizedBody?.error !== "UNAUTHORIZED") {
  throw new Error(
    "auth-discord-sync must reject unauthenticated requests with 401"
  );
}
console.log("[PASS] Discord sync rejects unauthenticated calls");

const method = await fetch(fn, {
  method: "GET",
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(15000),
});
if (method.status !== 405) {
  throw new Error("auth-discord-sync GET expected 405, got " + method.status);
}
console.log("[PASS] Discord sync is POST-only");

console.log("[PASS] M09 auth security smoke");

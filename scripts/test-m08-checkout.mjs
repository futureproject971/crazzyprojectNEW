const base = "https://nnmglkdpmffmaiuwbcct.supabase.co/functions/v1/purincash-payment";

const config = await fetch(base + "?action=config", {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(15000),
});
const configBody = await config.json();
if (!config.ok) throw new Error("config HTTP " + config.status);
if (!Array.isArray(configBody.methods)) throw new Error("methods missing");
for (const method of ["pix", "card", "crypto"]) {
  if (!configBody.methods.some((item) => item.method === method)) {
    throw new Error("missing method " + method);
  }
}
console.log("[PASS] config safe", {
  ready: configBody.ready,
  methods: configBody.methods.map((x) => x.method + ":" + x.enabled),
});

const quote = await fetch(base + "?action=quote", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cart_snapshot: [] }),
  signal: AbortSignal.timeout(15000),
});
if (quote.status !== 401) {
  throw new Error("unauthenticated quote expected 401, got " + quote.status);
}
console.log("[PASS] quote requires authentication");

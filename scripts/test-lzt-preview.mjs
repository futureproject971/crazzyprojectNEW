const base = "https://nnmglkdpmffmaiuwbcct.supabase.co/functions/v1/lzt-market";

const cases = [
  { name: "Riot / LoL", query: "action=preview-v2&category=riot&game=lol&page=1&schema=1", category: "riot" },
  { name: "Fortnite", query: "action=preview-v2&category=fortnite&page=1&schema=1", category: "fortnite" },
  { name: "Minecraft", query: "action=preview-v2&category=minecraft&page=1&schema=1", category: "minecraft" },
];

let failed = false;
let blocked = 0;

for (const test of cases) {
  try {
    const response = await fetch(base + "?" + test.query, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });

    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("non-JSON response: " + text.slice(0, 160));
    }

    if (!response.ok && body?.error === "LZT token not configured") {
      blocked += 1;
      console.warn("[BLOCKED]", test.name, "credential missing");
      continue;
    }

    if (!response.ok) {
      throw new Error("HTTP " + response.status + " " + JSON.stringify(body).slice(0, 300));
    }

    if (body.preview !== true) throw new Error("preview flag missing");
    if (body.category !== test.category) throw new Error("category mismatch");
    if (!Array.isArray(body.items)) throw new Error("items is not an array");
    if (!Array.isArray(body.providerFieldNames)) throw new Error("schema field list missing");

    console.log("[PASS]", test.name, "items=" + body.items.length, "total=" + (body.totalItems ?? "?"), "fields=" + body.providerFieldNames.length);
  } catch (error) {
    failed = true;
    console.error("[FAIL]", test.name, error instanceof Error ? error.message : error);
  }
}

if (blocked) {
  console.warn("[INFO] LZT runtime smoke blocked for " + blocked + "/" + cases.length + " cases until the project credential is configured.");
}
if (failed) process.exit(1);

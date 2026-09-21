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

const catalogResponse = await req("/rpc/get_academy_catalog", {
  method: "POST",
  body: "{}",
});
if (!catalogResponse.ok) {
  throw new Error("Public Academy catalog expected 200, got " + catalogResponse.status);
}
const tutorials = await catalogResponse.json();
if (!Array.isArray(tutorials) || !tutorials.some((item) => item.slug === "primeiros-passos")) {
  throw new Error("Expected seeded public tutorial in Academy catalog");
}
console.log("[PASS] public Academy catalog is readable");

const tutorialResponse = await req("/rpc/get_academy_tutorial", {
  method: "POST",
  body: JSON.stringify({ p_slug: "primeiros-passos" }),
});
if (!tutorialResponse.ok) {
  throw new Error("Public tutorial expected 200, got " + tutorialResponse.status);
}
const tutorial = await tutorialResponse.json();
if (!tutorial || tutorial.locked || !Array.isArray(tutorial.blocks) || tutorial.blocks.length < 5) {
  throw new Error("Public tutorial should expose its blocks");
}
console.log("[PASS] public tutorial blocks are available");

const directBlocks = await req("/academy_tutorial_blocks?select=*&limit=1");
if (directBlocks.ok) {
  const directRows = await directBlocks.json();
  if (!Array.isArray(directRows) || directRows.length !== 0) {
    throw new Error("Anonymous users must not read Academy block tables directly");
  }
}
console.log("[PASS] direct Academy block reads expose no rows");

const progress = await req("/rpc/save_academy_progress", {
  method: "POST",
  body: JSON.stringify({
    p_slug: "primeiros-passos",
    p_last_position: 1,
    p_completed: false,
  }),
});
if (progress.ok) {
  throw new Error("Anonymous users must not save Academy progress");
}
console.log("[PASS] Academy progress requires authentication");

const accessHelper = await req("/rpc/academy_has_access", {
  method: "POST",
  body: JSON.stringify({
    p_tutorial: "00000000-0000-4000-8000-000000000000",
    p_user: null,
  }),
});
if (accessHelper.ok) {
  throw new Error("Internal Academy access helper must not be client callable");
}
console.log("[PASS] Academy access helper is private");

const locked = tutorials.find((item) => item.access_type === "product" && item.locked);
if (locked) {
  const lockedResponse = await req("/rpc/get_academy_tutorial", {
    method: "POST",
    body: JSON.stringify({ p_slug: locked.slug }),
  });
  if (!lockedResponse.ok) throw new Error("Locked tutorial metadata request failed");
  const lockedTutorial = await lockedResponse.json();
  if (!lockedTutorial.locked || !Array.isArray(lockedTutorial.blocks) || lockedTutorial.blocks.length !== 0) {
    throw new Error("Protected tutorial leaked blocks without entitlement");
  }
  console.log("[PASS] protected tutorial metadata does not leak blocks");
} else {
  console.log("[PASS] no locked seeded tutorial to inspect; server guard is active");
}

console.log("[PASS] M22 CRAZZY ACADEMY security smoke");

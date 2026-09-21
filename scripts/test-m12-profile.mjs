const rest = "https://nnmglkdpmffmaiuwbcct.supabase.co/rest/v1";
const key = "sb_publishable_Gu8G1uqggVf2pvVenX7EPQ_yIi5t2Kb";

async function request(path, init = {}) {
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

for (const table of ["profile_preferences", "profiles", "user_roles", "discord_identities"]) {
  const response = await request("/" + table + "?select=*&limit=1");
  if (response.ok) {
    throw new Error(table + " must not be readable by anon");
  }
  console.log("[PASS] anon blocked from " + table + " (" + response.status + ")");
}

const patchProtectedProfile = await request(
  "/profiles?user_id=eq.00000000-0000-0000-0000-000000000000",
  {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ banned: false }),
  }
);
if (patchProtectedProfile.ok) {
  throw new Error("anon must not be able to mutate protected profiles");
}
console.log("[PASS] protected profiles reject unauthenticated mutation");

const patchPreferences = await request(
  "/profile_preferences?user_id=eq.00000000-0000-0000-0000-000000000000",
  {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ primary_color: "#0000FF" }),
  }
);
if (patchPreferences.ok) {
  throw new Error("anon must not be able to mutate profile preferences");
}
console.log("[PASS] profile preferences reject unauthenticated mutation");

const products = await request("/products?select=id&limit=1");
if (!products.ok) {
  throw new Error("public catalog should remain readable, got " + products.status);
}
console.log("[PASS] public catalog remains readable");
console.log("[PASS] M12 profile security smoke");

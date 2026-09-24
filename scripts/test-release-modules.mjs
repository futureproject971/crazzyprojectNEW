const { access, readFile } = await import("node:fs/promises");

const requiredFiles = {
  M31: [
    "src/modules/customer-360/Customer360Page.tsx",
    "src/app/api/admin/customers/route.ts",
  ],
  M32: [
    "src/modules/support-desk/SupportDeskPage.tsx",
    "src/app/api/admin/support/route.ts",
  ],
  M33: [
    "src/modules/community-mod/CommunityModPage.tsx",
    "src/app/api/admin/community-mod/route.ts",
  ],
  M34: [
    "src/modules/resellers/ResellerManagerPage.tsx",
    "src/app/api/admin/resellers/route.ts",
    "src/app/api/reseller/route.ts",
  ],
  M35: [
    "src/modules/club-manager/ClubManagerPage.tsx",
    "src/app/api/admin/club/route.ts",
  ],
  M36: [
    "src/modules/reward-manager/RewardManagerPage.tsx",
    "src/app/api/admin/rewards/route.ts",
  ],
  M37: [
    "src/modules/luck-manager/LuckManagerPage.tsx",
    "src/app/api/admin/luck/route.ts",
  ],
  M38: [
    "src/modules/coupon-manager/CouponManagerPage.tsx",
    "src/app/api/admin/coupons/route.ts",
  ],
  M39: [
    "src/modules/appearance-manager/AppearanceManagerPage.tsx",
    "src/app/api/admin/appearance/route.ts",
    "supabase/migrations/20260923013412_m39_appearance.sql",
  ],
  M40: [
    "src/modules/integrations/IntegrationsPage.tsx",
    "src/app/api/admin/integrations/route.ts",
  ],
  M41: [
    "src/modules/notifications/NotificationManagerPage.tsx",
    "src/app/api/admin/notifications/route.ts",
    "apps/discord-bot/src/modules/notifications.js",
  ],
  M42: [
    "src/app/manifest.ts",
    "src/core/pwa/PwaRegister.tsx",
    "public/sw.js",
  ],
  M43: [
    "src/modules/fulfillment-manager/FulfillmentManagerPage.tsx",
    "src/app/api/admin/fulfillment/route.ts",
    "supabase/migrations/20260922233855_m43_fulfillment_engine_core.sql",
  ],
  M44: [
    "src/modules/discord-bridge/DiscordBridgePage.tsx",
    "src/app/api/admin/discord-bridge/route.ts",
    "apps/discord-bot/src/modules/role-bridge.js",
  ],
  M45: [
    "src/modules/tutorial-studio/TutorialStudioPage.tsx",
    "supabase/migrations/20260922234721_m45_tutorial_studio.sql",
  ],
  M46: [
    "src/modules/mtsounds/native/Editor.tsx",
    "src/modules/mtsounds/native/MusicSearch.tsx",
    "src/app/mtsounds/editor/page.tsx",
  ],
  M47: [
    "src/modules/security-sentinel/SecuritySentinelPage.tsx",
    "src/app/api/admin/security/route.ts",
    "apps/discord-bot/src/modules/security-sentinel.js",
    "supabase/migrations/20260922234418_m47_security_sentinel_core.sql",
  ],
};

for (const [module, files] of Object.entries(requiredFiles)) {
  for (const file of files) {
    try {
      await access(file);
    } catch {
      throw new Error(module + " release artifact missing: " + file);
    }
  }
  console.log("[PASS] " + module + " release artifacts present");
}

const pwa = await readFile("public/sw.js", "utf8");
if (!pwa.includes("fetch") || !pwa.includes("caches")) {
  throw new Error("M42 service worker is not functional");
}

const fulfillment = await readFile("supabase/migrations/20260922233855_m43_fulfillment_engine_core.sql", "utf8");
for (const required of [
  "fulfillment_key",
  "on conflict (fulfillment_key)",
  "entitlement_id",
  "fulfillment_events_ticket_type_unique_idx",
  "discord_role_grants_entitlement_role_unique_idx",
]) {
  if (!fulfillment.toLowerCase().includes(required.toLowerCase())) {
    throw new Error("M43 fulfillment migration is missing idempotency primitive: " + required);
  }
}

const bridge = await readFile("apps/discord-bot/src/modules/role-bridge.js", "utf8");
if (!/grant|revoke/i.test(bridge)) throw new Error("M44 bridge lacks grant/revoke handling");

const security = await readFile("apps/discord-bot/src/modules/security-sentinel.js", "utf8");
if (!/CRITICAL/.test(security)) throw new Error("M47 security worker lacks CRITICAL handling");

console.log("[PASS] M31-M47 release artifact audit");

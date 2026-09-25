import { readFile } from "node:fs/promises";

const files = {
  homeChat: await readFile("src/components/chat/GeneralChat.tsx", "utf8"),
  community: await readFile("src/modules/community/CommunityPage.tsx", "utf8"),
  product: await readFile("src/modules/product-view/ProductView.tsx", "utf8"),
  catalog: await readFile("src/modules/catalog/CatalogPage.tsx", "utf8"),
  newTicket: await readFile("src/modules/support/NewTicketPage.tsx", "utf8"),
  hub: await readFile("src/modules/client-hub/ClientHubPage.tsx", "utf8"),
  library: await readFile("src/modules/library/LibraryPage.tsx", "utf8"),
  benefits: await readFile("src/components/hero/BenefitsBar.tsx", "utf8"),
  featuredProducts: await readFile("src/components/products/FeaturedProductsCarousel.tsx", "utf8"),
  migration: await readFile("supabase/migrations/20260924231500_m14_live_home_community.sql", "utf8"),
};

for (const required of [
  "/api/community/preview?channel=geral&limit=8",
  "/api/community/messages",
  "createBrowserSupabaseClient",
  "home-community-preview",
  "Escreva no Chat Geral",
]) {
  if (!files.homeChat.includes(required)) {
    throw new Error("Homepage chat is not wired to the real community: " + required);
  }
}
if (files.homeChat.includes("chatMessages")) {
  throw new Error("Homepage chat must not use static fake messages");
}
console.log("[PASS] homepage Chat Geral uses the real community");

for (const required of [
  "community_messages",
  "community_reactions",
  "community_attachments",
  "community_channels",
]) {
  if (!files.migration.includes("alter publication supabase_realtime add table public." + required)) {
    throw new Error("Community Realtime migration missing: " + required);
  }
}
if (!files.migration.includes("get_public_community_preview")) {
  throw new Error("Safe public community preview RPC is missing");
}
console.log("[PASS] community preview and realtime are versioned");

const forbiddenCustomerCopy = [
  ["product", files.product, ["Product Manager", "fulfillment", "entitlement", "catálogo real", "servidor antes da cobrança"]],
  ["catalog", files.catalog, ["Product Manager", "Catálogo ao vivo da CRAZZY PROJECT", "servidor antes de cobrar"]],
  ["community", files.community, ["M14 •", "bucket não é público", "links temporários"]],
  ["newTicket", files.newTicket, ["bucket privado", "bucket não é público", "entitlement ou entrega"]],
  ["hub", files.hub, ["Support Desk entra no M13", "FULFILLMENT", "DISCORD SYNC", "membership não confirmado", "auditoria"]],
  ["library", files.library, ["M11 •", "AUDITORIA", "viewer no M22"]],
];

for (const [name, source, forbidden] of forbiddenCustomerCopy) {
  for (const phrase of forbidden) {
    if (source.includes(phrase)) {
      throw new Error(name + " still exposes internal implementation copy: " + phrase);
    }
  }
}
console.log("[PASS] customer pages do not expose admin/backend implementation copy");

if (files.benefits.includes("+50.000") || files.benefits.includes("Produtos Originais")) {
  throw new Error("Homepage still contains unsupported template claims");
}
console.log("[PASS] homepage template claims removed");

if (files.featuredProducts.includes('<span className="product-art-brand">{product.name}</span>')) {
  throw new Error("Featured product name must not be duplicated over the artwork");
}
console.log("[PASS] featured product name appears only in the info area");

if (!files.community.includes('table: "community_messages"') || files.community.includes("}, 4000)")) {
  throw new Error("Full Community must use Realtime instead of 4-second polling");
}
console.log("[PASS] full Community uses Realtime");

console.log("[PASS] customer-facing cleanup smoke");

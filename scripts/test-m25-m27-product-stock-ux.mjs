const { readFile } = await import("node:fs/promises");

const productManager = await readFile(
  "src/modules/product-manager/ProductManagerPage.tsx",
  "utf8"
);
const stockRoute = await readFile(
  "src/app/api/admin/stock/route.ts",
  "utf8"
);
const productUploadRoute = await readFile(
  "src/app/api/admin/products/upload/route.ts",
  "utf8"
);
const productStyles = await readFile(
  "src/modules/product-manager/styles.css",
  "utf8"
);
const stockManagerUi = await readFile(
  "src/modules/stock-manager/StockManagerPage.tsx",
  "utf8"
);
const commerceHardening = await readFile(
  "supabase/migrations/20260923191639_discord_partner_commerce_hardening.sql",
  "utf8"
);
const purinPresentationMigration = await readFile(
  "supabase/migrations/20260924222000_m25_purin_product_presentation.sql",
  "utf8"
);
const productsRoute = await readFile(
  "src/app/api/admin/products/route.ts",
  "utf8"
);

for (const required of [
  "productPlanId: plan.id",
  'source: "product-manager"',
  "/api/admin/products/upload",
  "VISÃO GERAL DO CATÁLOGO",
  "productStockMeta(product)",
  "productPriceRange(product)",
  "Sem estoque",
  "crz-purin-dialog",
  "crz-purin-dialog--editor",
  "Planos & Estoque",
  "＋ Adicionar Plano",
  "Estoque do plano",
  "Keys deste plano — uma por linha",
  "Adicionar " + "\" + stockItems.length",
  "saveEditorChanges",
  "managePlans",
]) {
  if (!productManager.includes(required)) {
    throw new Error("Product Manager per-plan stock UX missing: " + required);
  }
}
console.log("[PASS] Product Manager exposes visual per-plan stock workflow");

for (const forbidden of [
  'className="crz-pm-layout"',
  "Estoque Personalizado",
  "Modo de entrega",
  "Adicionar keys / códigos ao estoque",
  "ESTOQUE DESTE PLANO",
]) {
  if (productManager.includes(forbidden)) {
    throw new Error("Product Manager still contains duplicated legacy product/stock editor: " + forbidden);
  }
}
console.log("[PASS] Product Manager keeps one clear plan/stock editing flow");

for (const required of [
  'supabase.rpc("import_stock_batch"',
  "rawItems.length > 5000",
  "INVALID_STOCK_ITEM",
]) {
  if (!stockRoute.includes(required)) {
    throw new Error("Admin stock route missing protection: " + required);
  }
}
console.log("[PASS] Product Manager stock import reuses guarded Stock Manager API");

for (const forbidden of ["+ Importar keys", "importText", "importBatch"]) {
  if (stockManagerUi.includes(forbidden)) {
    throw new Error("Advanced Stock Manager must not duplicate stock import UI: " + forbidden);
  }
}
if (!stockManagerUi.includes("Gerenciar produtos") || !stockManagerUi.includes("Editar produto")) {
  throw new Error("Advanced Stock Manager must route product/stock changes back to Products");
}
console.log("[PASS] Stock Manager is audit-only; stock addition lives in Products");

for (const required of [
  'supabase.rpc("is_current_admin")',
  '.from("site-branding")',
  "MAX_BYTES = 10 * 1024 * 1024",
]) {
  if (!productUploadRoute.includes(required)) {
    throw new Error("Product image upload missing admin/storage guard: " + required);
  }
}
console.log("[PASS] Product image upload is admin-only and size-limited");

for (const required of [
  ".crz-pm-overview",
  ".crz-pm-overview__stock.is-low",
  ".crz-pm-overview__stock.is-out",
  ".crz-purin-dialog",
  ".crz-purin-tabs",
  ".crz-purin-variation__editor",
  ".crz-purin-stock-simple",
  ".crz-purin-stock-modal",
]) {
  if (!productStyles.includes(required)) {
    throw new Error("Product Manager visual style missing: " + required);
  }
}
console.log("[PASS] Product Manager visual navigation and stock styles are versioned");

for (const required of [
  "add column if not exists icon_url text",
  "add column if not exists banner_url text",
  "hide_delivery_badge boolean",
  "save_product_manager_presentation",
  "'icon_url',p.icon_url",
  "'banner_url',p.banner_url",
]) {
  if (!purinPresentationMigration.includes(required)) {
    throw new Error("Purin-style product presentation migration missing: " + required);
  }
}
console.log("[PASS] Purin-style separate icon/banner fields are persisted");

for (const required of [
  'supabase.rpc("save_product_manager_presentation"',
  "p_icon_url: safeAssetUrl",
  "p_banner_url: safeAssetUrl",
  "p_hide_delivery_badge",
]) {
  if (!productsRoute.includes(required)) {
    throw new Error("Product presentation API missing: " + required);
  }
}
console.log("[PASS] Product API saves familiar editor presentation fields");

for (const required of [
  "reserve_stock_for_fulfillment(",
  "product_plan_id",
  "claim_paid_delivery",
  "STOCK_RESERVATION_REQUIRED",
  "library_deliveries",
  "delivery_mode='internal_stock'",
]) {
  if (!commerceHardening.includes(required)) {
    throw new Error("Commerce fulfillment does not prove per-plan delivery: " + required);
  }
}
console.log("[PASS] Paid delivery reserves and fulfills stock by exact product plan");

console.log("[PASS] M25/M27 Product + Stock UX integration smoke");

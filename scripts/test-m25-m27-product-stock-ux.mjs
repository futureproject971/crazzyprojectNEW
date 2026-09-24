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

for (const required of [
  "ESTOQUE DESTE PLANO",
  "Adicionar keys / códigos ao estoque",
  "productPlanId: planDraft.id",
  'source: "product-manager"',
  "Escolher imagem do PC",
  "/api/admin/products/upload",
  "Planos & Estoque",
  'href="#pm-geral"',
  'href="#pm-planos"',
  'href="#pm-automacao"',
]) {
  if (!productManager.includes(required)) {
    throw new Error("Product Manager per-plan stock UX missing: " + required);
  }
}
console.log("[PASS] Product Manager exposes visual per-plan stock workflow");

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
  ".crz-pm-visual-summary",
  ".crz-pm-stock-section",
  ".crz-pm-section-nav",
]) {
  if (!productStyles.includes(required)) {
    throw new Error("Product Manager visual style missing: " + required);
  }
}
console.log("[PASS] Product Manager visual navigation and stock styles are versioned");

console.log("[PASS] M25/M27 Product + Stock UX integration smoke");

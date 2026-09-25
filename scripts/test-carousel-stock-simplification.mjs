import { readFile } from "node:fs/promises";

const carousel = await readFile("src/components/products/FeaturedProductsCarousel.tsx","utf8");
const stock = await readFile("src/modules/stock-manager/StockManagerPage.tsx","utf8");
const stockStyles = await readFile("src/modules/stock-manager/styles.css","utf8");
const productManager = await readFile("src/modules/product-manager/ProductManagerPage.tsx","utf8");

if (carousel.includes('className="product-art-brand"')) {
  throw new Error("Featured carousel still repeats product name over the artwork");
}
if (!carousel.includes("<strong>{product.name}</strong>")) {
  throw new Error("Featured carousel must keep product name in the info block");
}
console.log("[PASS] featured carousel shows product name only below the image");

for (const required of [
  'title="Keys por plano"',
  'Gerenciar produtos',
  'Aqui você só confere e corrige keys',
  'masked_content',
]) {
  if (!stock.includes(required)) {
    throw new Error("Simplified Stock Manager missing: " + required);
  }
}

for (const forbidden of [
  "LOTES RECENTES",
  "Movimentações de estoque",
  "Adicionar estoque no produto",
  "fornecedor:",
]) {
  if (stock.includes(forbidden)) {
    throw new Error("Stock Manager still duplicates product/stock management: " + forbidden);
  }
}

if (!stockStyles.includes(".crz-stock-summary--simple") || !stockStyles.includes(".crz-stock-plan-metrics--simple")) {
  throw new Error("Simplified Stock Manager layout styles missing");
}

for (const required of [
  "Entrega e estoque",
  "Adicionar Estoque",
  "Salvar plano",
]) {
  if (!productManager.includes(required)) {
    throw new Error("Product Manager must remain the single stock-entry workflow: " + required);
  }
}

if (productManager.includes("Estoque Personalizado") || productManager.includes("Usar estoque")) {
  throw new Error("Product Manager still contains duplicated stock controls");
}

console.log("[PASS] product + stock admin workflow is simplified and non-duplicative");

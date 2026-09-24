const { readFile } = await import("node:fs/promises");

const files = {
  catalog: await readFile("src/modules/catalog/CatalogPage.tsx", "utf8"),
  productPage: await readFile("src/app/produto/[slug]/page.tsx", "utf8"),
  productView: await readFile("src/modules/product-view/ProductView.tsx", "utf8"),
  discovery: await readFile("src/modules/discovery/DiscoveryPage.tsx", "utf8"),
  featured: await readFile("src/components/products/FeaturedProductsCarousel.tsx", "utf8"),
  categories: await readFile("src/components/categories/StoreShowcase.tsx", "utf8"),
  api: await readFile("src/app/api/products/route.ts", "utf8"),
  live: await readFile("src/modules/catalog/live.ts", "utf8"),
};

for (const required of [
  'supabase.rpc("get_public_store_catalog")',
  "normalizePublicCatalog",
]) {
  if (!files.api.includes(required)) throw new Error("Live storefront API missing " + required);
}

for (const [name, source] of Object.entries({
  catalog: files.catalog,
  discovery: files.discovery,
  featured: files.featured,
})) {
  if (!source.includes('fetch("/api/products"')) {
    throw new Error(name + " must consume the live /api/products catalog");
  }
}

for (const required of [
  'supabase.rpc("get_public_store_catalog")',
  "<ProductView product={product}",
]) {
  if (!files.productPage.includes(required)) throw new Error("Live product route missing " + required);
}

for (const forbidden of [
  "getProductDetail(",
  "getAllProductSlugs(",
  "rating: 4.8",
  "ratingCount: 127",
  "GTA V Premium",
  "AI Toolkit",
  "CRAZZY Premium Bundle",
]) {
  for (const [name, source] of Object.entries({
    catalog: files.catalog,
    productPage: files.productPage,
    productView: files.productView,
    discovery: files.discovery,
    featured: files.featured,
  })) {
    if (source.includes(forbidden)) throw new Error(name + " still contains storefront mock: " + forbidden);
  }
}

if (!files.live.includes('currency: "BRL"') || !files.live.includes("getProductStock")) {
  throw new Error("Live storefront must format BRL and derive real stock state");
}

if (!files.categories.includes('fetch("/api/categories"')) {
  throw new Error("Home category showcase must use live categories");
}

console.log("[PASS] public storefront uses live Supabase catalog without legacy product mocks");

import type { PublicStoreProduct } from "../catalog/live";

export function getComboProducts(products: PublicStoreProduct[], family: "30d" | "lifetime") {
  return products.flatMap(product => {
    const plan = (product.plans || []).filter(candidate =>
      candidate.plan_code === family && Number.isFinite(Number(candidate.price)) && Number(candidate.price) > 0 &&
      (!candidate.stock_managed || Number(candidate.stock_count) > 0)
    ).sort((a, b) => a.sort_order - b.sort_order || Number(a.price) - Number(b.price))[0];
    return plan ? [{ product, plan }] : [];
  });
}

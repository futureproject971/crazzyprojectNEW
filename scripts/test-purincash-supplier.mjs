import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

const [
  productManager,
  productsRoute,
  supplierRoute,
  supplierModal,
  checkout,
  purin,
  migration,
] = await Promise.all([
  read("src/modules/product-manager/ProductManagerPage.tsx"),
  read("src/app/api/admin/products/route.ts"),
  read("src/app/api/admin/purincash/supplier/route.ts"),
  read("src/modules/product-manager/SupplierImportModal.tsx"),
  read("supabase/functions/_shared/checkout.ts"),
  read("supabase/functions/purincash-payment/index.ts"),
  read("supabase/migrations/20260926210000_purincash_supplier_engine.sql"),
]);

function expect(condition, message) {
  if (!condition) throw new Error(message);
  console.log("[PASS] " + message);
}

expect(
  !productManager.includes('delivery_mode: "internal_stock", automation_flags'),
  "Product Manager no longer forces every saved plan to internal_stock",
);
expect(
  !productManager.includes('return { ...JSON.parse(JSON.stringify(plan)), delivery_mode: "internal_stock"'),
  "editing a plan preserves its real delivery mode",
);
expect(
  productManager.includes('presetPlans: newProduct.startMode === "presets" ? newProduct.presetPlans : []'),
  "new-product preset selection reaches the backend",
);
expect(
  productManager.includes("SupplierImportModal") &&
    productManager.includes("🌐 Importar do provedor") &&
    supplierModal.includes('placeholder="prod_..."'),
  "provider importer is available in Product Manager",
);

expect(
  supplierModal.includes('createPortal(modal, document.body)') &&
    supplierModal.includes('document.body.style.overflow = "hidden"'),
  "supplier importer escapes the Product Manager stacking context via a body portal",
);

expect(
  supplierModal.includes("friendlySupplierError") &&
    purin.includes("PURINCASH_NETWORK_UNAVAILABLE") &&
    purin.includes('"/products?include=store&includeInactive=true"'),
  "supplier catalog handles upstream network failures and retries through the documented store-catalog fallback",
);
expect(
  productsRoute.includes("allowedPresets") &&
    productsRoute.includes("SUPPLIER_BINDING_INVALID") &&
    productsRoute.includes('key.startsWith("supplier_")'),
  "admin product API validates presets and supplier bindings",
);
expect(
  supplierRoute.includes('"supplier-catalog"') &&
    supplierRoute.includes('"supplier-import"') &&
    supplierRoute.includes('"supplier-bind"') &&
    supplierRoute.includes('"supplier-sync"'),
  "admin provider proxy exposes only the expected supplier actions",
);
expect(
  checkout.includes('"resolve_checkout_plan_operation"') &&
    checkout.includes('"purincash-supplier"') &&
    checkout.includes('"claim_external_paid_delivery"'),
  "checkout resolves private bindings and uses external idempotent delivery",
);
expect(
  checkout.includes("Produtos de fornecedor devem ser finalizados individualmente.") &&
    checkout.includes("Cupons não estão disponíveis para produtos de fornecedor."),
  "supplier checkout rejects unsafe mixed/discounted carts",
);
expect(
  purin.includes('"/store/products?includeInactive=true"') &&
    purin.includes("fetchProviderDelivery") &&
    purin.includes("/deliveries/"),
  "PurinCash integration uses catalog plus delivery reconciliation",
);
expect(
  (purin.match(/\.\.\.\(supplier \? \{ supplier \} : \{\}\)/g) || []).length === 2,
  "supplier object is added only to charge/payment creation paths",
);
expect(
  purin.includes("Pagamento por cartão não está disponível para produtos de fornecedor."),
  "card checkout is fail-closed for supplier items",
);
expect(
  !/console\.(?:log|warn|error)[^\n]*deliveredContent/i.test(purin),
  "deliveredContent is never written to logs",
);
expect(
  migration.includes("private.library_delivery_secrets") &&
    migration.includes("claim_external_paid_delivery") &&
    migration.includes("grant execute on function public.claim_external_paid_delivery") &&
    migration.includes("to service_role"),
  "supplier delivery reuses the private Library vault and service-role boundary",
);
expect(
  migration.includes("admin_import_purincash_supplier_plans") &&
    migration.includes("admin_bind_purincash_supplier_plan") &&
    migration.includes("admin_sync_purincash_supplier_binding"),
  "supplier import, rebind and sync database operations exist",
);

const hardeningMigration = await read(
  "supabase/migrations/20260926224000_supplier_hardening_crazzy_screen_presence.sql",
);
expect(
  hardeningMigration.includes("from public,anon,authenticated") &&
    (hardeningMigration.match(/to service_role;/g) || []).length >= 4,
  "supplier SECURITY DEFINER mutations are no longer executable by authenticated browser sessions",
);
expect(
  purin.includes('markSupplierStatus(supabaseAdmin, planId, "unavailable")') &&
    purin.includes('markSupplierCheckoutStatus(supabaseAdmin, checkout, "stale")') &&
    purin.includes('supabaseAdmin.rpc("admin_import_purincash_supplier_plans"'),
  "supplier sync/checkout failures invalidate stale bindings through service-role RPCs",
);
expect(
  migration.includes("get_public_store_catalog") &&
    migration.includes("supplier_sync_status") &&
    migration.includes("supplier_unlimited"),
  "public catalog fails closed using synchronized external availability",
);
expect(
  !productManager.includes("PURINCASH_API_KEY") &&
    !supplierModal.includes("PURINCASH_API_KEY") &&
    !supplierRoute.includes("PURINCASH_API_KEY"),
  "PurinCash secret is not exposed to Next.js client/admin UI",
);

console.log("[PASS] PurinCash Supplier Engine static security/architecture smoke");

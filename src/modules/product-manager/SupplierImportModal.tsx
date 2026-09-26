"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type SupplierVariation = {
  id: string | null;
  index: number;
  name: string;
  planCode: string;
  priceCents: number;
  stock: number | null;
  unlimited: boolean;
  active: boolean;
};

type SupplierProduct = {
  storeProductId: string;
  supplierProductId: string | null;
  name: string;
  category: string;
  active: boolean;
  variations: SupplierVariation[];
};

type Props = {
  productId: string;
  productName: string;
  replacePlanId?: string | null;
  onClose: () => void;
  onImported: () => void | Promise<void>;
};

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.max(0, Number(cents || 0)) / 100);
}

function variationKey(product: SupplierProduct, variation: SupplierVariation) {
  return product.storeProductId + "::" + (variation.id || String(variation.index));
}

function available(variation: SupplierVariation) {
  return variation.active && (variation.unlimited || (variation.stock !== null && variation.stock > 0));
}

function friendlySupplierError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/NetworkError|Failed to fetch|fetch resource|network request failed/i.test(message)) {
    return "A PurinCash não respondeu agora. Tente atualizar o catálogo em alguns segundos.";
  }
  return message || "Não foi possível consultar o provedor.";
}

export function SupplierImportModal({ productId, productName, replacePlanId = null, onClose, onImported }: Props) {
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualIds, setManualIds] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const load = async () => {
    setState("loading");
    setNotice("");
    try {
      const response = await fetch("/api/admin/purincash/supplier", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload?.products)) {
        throw new Error(payload?.error || "Não foi possível consultar o provedor.");
      }
      setProducts(payload.products);
      setState("ready");
    } catch (error) {
      setNotice(friendlySupplierError(error));
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return products;
    return products.filter((product) =>
      [product.name, product.category, ...product.variations.map((variation) => variation.name)]
        .some((text) => String(text || "").toLowerCase().includes(value))
    );
  }, [products, query]);

  const selectedCount = selected.size;

  const toggle = (product: SupplierProduct, variation: SupplierVariation) => {
    if (!available(variation) || busy) return;
    const key = variationKey(product, variation);
    setSelected((current) => {
      if (replacePlanId) return current.has(key) ? new Set() : new Set([key]);
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = async () => {
    if (!selected.size || busy) return;
    const selections: Array<Record<string, unknown>> = [];

    for (const product of products) {
      for (const variation of product.variations) {
        if (!selected.has(variationKey(product, variation))) continue;
        const supplierProductId = product.supplierProductId || String(manualIds[product.storeProductId] || "").trim();
        if (!/^prod_[A-Za-z0-9_-]+$/.test(supplierProductId)) {
          setNotice(`Informe o ID público prod_... de "${product.name}" antes de importar.`);
          return;
        }
        selections.push({
          storeProductId: product.storeProductId,
          supplierProductId,
          variationId: variation.id,
          variationIndex: variation.index,
        });
      }
    }

    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/purincash/supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          replacePlanId
            ? { action: "bind", planId: replacePlanId, selection: selections[0] }
            : { action: "import", productId, selections },
        ),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Não foi possível importar as variações.");
      const count = replacePlanId ? 1 : Number(payload?.imported?.count || 0);
      setNotice(
        replacePlanId
          ? "Vínculo do plano atualizado."
          : count
            ? `${count} plano(s) importado(s).`
            : "Nenhum plano novo foi criado. Os vínculos selecionados já existiam.",
      );
      await onImported();
      if (replacePlanId || count > 0) onClose();
    } catch (error) {
      setNotice(friendlySupplierError(error));
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;

  const modal = (
    <div className="crz-supplier-modal" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="crz-supplier-dialog" role="dialog" aria-modal="true" aria-label="Importar do provedor">
        <header>
          <div>
            <small>ESTOQUE AUTOMÁTICO</small>
            <h3>{replacePlanId ? "Trocar vínculo do provedor" : "Importar do provedor"}</h3>
            <p>{replacePlanId ? "Escolha a nova variação para este plano de " : "As variações selecionadas viram planos de "}<strong>{productName}</strong>.</p>
          </div>
          <button type="button" className="crz-supplier-close" onClick={onClose} disabled={busy} aria-label="Fechar">×</button>
        </header>

        <div className="crz-supplier-toolbar">
          <label>
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto ou variação..." />
          </label>
          <button type="button" onClick={() => void load()} disabled={busy || state === "loading"}>
            {state === "loading" ? "Atualizando..." : "Atualizar catálogo"}
          </button>
        </div>

        {notice && <p className="crz-supplier-notice" role="status">{notice}</p>}
        {state === "loading" && <div className="crz-supplier-state"><span className="crz-spinner" /> Consultando PurinCash...</div>}
        {state === "error" && <div className="crz-supplier-state">Não foi possível carregar o catálogo. <button type="button" onClick={() => void load()}>Tentar novamente</button></div>}

        {state === "ready" && (
          <div className="crz-supplier-list">
            {filtered.map((product) => (
              <article key={product.storeProductId || product.name} className={!product.active ? "is-disabled" : ""}>
                <div className="crz-supplier-product-head">
                  <div>
                    <strong>{product.name}</strong>
                    <small>{product.category || "Sem categoria"} · {product.variations.length} variação(ões)</small>
                  </div>
                  <span>{product.supplierProductId ? "ID público detectado" : "ID público necessário"}</span>
                </div>

                {!product.supplierProductId && (
                  <label className="crz-supplier-public-id">
                    <span>ID público do fornecedor</span>
                    <input
                      value={manualIds[product.storeProductId] || ""}
                      onChange={(event) => setManualIds((current) => ({
                        ...current,
                        [product.storeProductId]: event.target.value.trim(),
                      }))}
                      placeholder="prod_..."
                      spellCheck={false}
                    />
                    <small>A PurinCash não expôs um ID prod_... inequívoco neste item. Informe o ID público mostrado no painel do fornecedor.</small>
                  </label>
                )}

                <div className="crz-supplier-variations">
                  {product.variations.map((variation) => {
                    const key = variationKey(product, variation);
                    const checked = selected.has(key);
                    const isAvailable = product.active && available(variation);
                    return (
                      <button
                        type="button"
                        key={key}
                        disabled={!isAvailable || busy}
                        className={checked ? "is-selected" : ""}
                        onClick={() => toggle(product, variation)}
                      >
                        <i>{checked ? "✓" : ""}</i>
                        <span>
                          <strong>{variation.name}</strong>
                          <small>
                            {brl(variation.priceCents)} · {variation.unlimited ? "∞ estoque externo" : variation.stock === null ? "estoque externo" : variation.stock + " em estoque"}
                          </small>
                        </span>
                        <em>{isAvailable ? "Disponível" : "Indisponível"}</em>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
            {!filtered.length && <div className="crz-supplier-state">Nenhum item encontrado.</div>}
          </div>
        )}

        <footer>
          <span>{selectedCount} selecionado(s)</span>
          <div>
            <button type="button" onClick={onClose} disabled={busy}>Cancelar</button>
            <button type="button" className="is-primary" disabled={busy || !selectedCount} onClick={() => void submit()}>
              {busy ? "Salvando..." : replacePlanId ? "Usar esta variação" : "Importar " + selectedCount}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}

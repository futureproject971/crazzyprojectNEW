"use client";
import { useCallback, useEffect, useState } from "react";
import { normalizePublicCatalog, type PublicStoreProduct } from "./live";

export function useStoreCatalog() {
  const [products, setProducts] = useState<PublicStoreProduct[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    try {
      const response = await fetch("/api/products", { cache: "no-store", signal });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.products)) throw new Error("CATALOG_UNAVAILABLE");
      setProducts(normalizePublicCatalog(payload.products));
      setState("ready");
    } catch { if (!signal?.aborted) setState("error"); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return { products, state, reload: () => load() };
}

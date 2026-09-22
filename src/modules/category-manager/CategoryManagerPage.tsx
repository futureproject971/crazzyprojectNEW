"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";
import type { CategoryManagerCatalog, CategoryManagerItem } from "./types";

function cloneCategory(category: CategoryManagerItem): CategoryManagerItem {
  return structuredClone(category);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function CategoryManagerPage() {
  const [catalog, setCatalog] = useState<CategoryManagerCatalog | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "forbidden" | "error">("loading");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryManagerItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [newCategory, setNewCategory] = useState({
    name: "",
    slug: "",
    description: "",
    icon_url: "",
    image_url: "",
    emoji: "🎮",
    accent_color: "#1687FF",
  });

  const load = async (preserveSelection = true) => {
    setState("loading");
    try {
      const response = await fetch("/api/admin/categories", { cache: "no-store" });
      if (response.status === 401) return setState("auth");
      if (response.status === 403) return setState("forbidden");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.catalog) throw new Error("CATEGORY_MANAGER_LOAD_FAILED");

      const next = payload.catalog as CategoryManagerCatalog;
      setCatalog(next);

      const selected =
        next.categories.find((item) => item.id === (preserveSelection ? selectedId : null)) ||
        next.categories[0] ||
        null;
      setSelectedId(selected?.id || null);
      setDraft(selected ? cloneCategory(selected) : null);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void load(false);
  }, []);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog.categories;
    return catalog.categories.filter((item) =>
      [item.name, item.slug, item.description]
        .some((value) => String(value || "").toLowerCase().includes(normalized))
    );
  }, [catalog, query]);

  const selectCategory = (category: CategoryManagerItem) => {
    setSelectedId(category.id);
    setDraft(cloneCategory(category));
    setNotice("");
  };

  const createCategory = async () => {
    if (busy || !newCategory.name.trim()) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newCategory,
          slug: newCategory.slug || slugify(newCategory.name),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.created?.id) {
        throw new Error(
          payload.error === "CATEGORY_SLUG_EXISTS"
            ? "Já existe uma categoria com esse slug."
            : "Falha ao criar categoria."
        );
      }

      setSelectedId(String(payload.created.id));
      setCreating(false);
      setNewCategory({
        name: "",
        slug: "",
        description: "",
        icon_url: "",
        image_url: "",
        emoji: "🎮",
        accent_color: "#1687FF",
      });
      setNotice("Categoria criada desativada. Revise e ative quando estiver pronta.");
      await load(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao criar categoria.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: draft }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error === "CATEGORY_SLUG_EXISTS"
            ? "Já existe outra categoria com esse slug."
            : "Falha ao salvar categoria."
        );
      }
      setNotice("Categoria salva.");
      await load(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao salvar categoria.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading" && !catalog) {
    return (
      <main className="crz-category-manager crz-cm-state">
        <span className="crz-spinner" />
        <strong>Carregando categorias...</strong>
      </main>
    );
  }

  if (state === "auth") {
    return (
      <main className="crz-category-manager crz-cm-state">
        <NeonIcon name="shield" size={42} />
        <strong>Entre para continuar</strong>
        <a className="crz-button crz-button--primary crz-button--sm" href="/login?next=%2Fadmin%2Fcategorias">
          Entrar
        </a>
      </main>
    );
  }

  if (state === "forbidden") {
    return (
      <main className="crz-category-manager crz-cm-state">
        <NeonIcon name="shield" size={42} />
        <strong>Acesso restrito ao administrador</strong>
      </main>
    );
  }

  if (state === "error" || !catalog) {
    return (
      <main className="crz-category-manager crz-cm-state">
        <strong>Category Manager indisponível</strong>
        <button type="button" onClick={() => void load(false)}>Tentar novamente</button>
      </main>
    );
  }

  return (
    <main className="crz-category-manager">
      <div className="crz-container crz-cm-container">
        <PageHeader
          eyebrow="M26 • CRAZZY CATEGORY MANAGER"
          title="Categorias, jogos e ordem da vitrine"
          description="Gerencie as categorias reais usadas pelos produtos e pela página pública do CRAZZY PROJECT."
          actions={
            <a className="crz-button crz-button--secondary crz-button--sm" href="/admin/produtos">
              Product Manager
            </a>
          }
        />

        {notice && <div className="crz-cm-notice">{notice}</div>}

        <div className="crz-cm-layout">
          <aside className="crz-cm-list-panel">
            <div className="crz-cm-list-head">
              <span>CATEGORIAS</span>
              <button type="button" onClick={() => setCreating((value) => !value)}>
                {creating ? "Cancelar" : "+ Categoria"}
              </button>
            </div>

            {creating && (
              <div className="crz-cm-create">
                <input
                  value={newCategory.name}
                  onChange={(event) => {
                    const name = event.target.value.slice(0, 100);
                    setNewCategory((current) => ({
                      ...current,
                      name,
                      slug: current.slug || slugify(name),
                    }));
                  }}
                  placeholder="Nome"
                />
                <input
                  value={newCategory.slug}
                  onChange={(event) =>
                    setNewCategory((current) => ({
                      ...current,
                      slug: slugify(event.target.value),
                    }))
                  }
                  placeholder="slug"
                />
                <textarea
                  value={newCategory.description}
                  onChange={(event) =>
                    setNewCategory((current) => ({
                      ...current,
                      description: event.target.value.slice(0, 1000),
                    }))
                  }
                  placeholder="Descrição curta"
                  rows={2}
                />
                <div>
                  <input
                    value={newCategory.emoji}
                    onChange={(event) => setNewCategory((current) => ({ ...current, emoji: event.target.value.slice(0, 32) }))}
                    aria-label="Emoji"
                  />
                  <input
                    type="color"
                    value={newCategory.accent_color}
                    onChange={(event) => setNewCategory((current) => ({ ...current, accent_color: event.target.value }))}
                    aria-label="Cor"
                  />
                </div>
                <button
                  type="button"
                  className="crz-button crz-button--primary crz-button--sm"
                  disabled={busy || !newCategory.name.trim()}
                  onClick={() => void createCategory()}
                >
                  {busy ? "Criando..." : "Criar categoria"}
                </button>
              </div>
            )}

            <label className="crz-cm-search">
              <span>⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar categoria..." />
            </label>

            <div className="crz-cm-list">
              {filtered.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={category.id === selectedId ? "is-active" : ""}
                  onClick={() => selectCategory(category)}
                >
                  <span
                    className="crz-cm-list-icon"
                    style={{ "--accent": category.accent_color || "#1687ff" } as React.CSSProperties}
                  >
                    {category.icon_url ? <img src={category.icon_url} alt="" /> : category.emoji || "◆"}
                  </span>
                  <span>
                    <strong>{category.name}</strong>
                    <small>/{category.slug || "sem-slug"} • {category.product_count} produto(s)</small>
                  </span>
                  <Badge tone={category.active ? "green" : "neutral"}>
                    {category.active ? "ON" : "OFF"}
                  </Badge>
                </button>
              ))}
            </div>
          </aside>

          <section className="crz-cm-editor">
            {!draft ? (
              <div className="crz-cm-state">Nenhuma categoria selecionada.</div>
            ) : (
              <>
                <header className="crz-cm-editor-head">
                  <div>
                    <small>CATEGORIA</small>
                    <h2>{draft.name}</h2>
                    <span>{draft.active_product_count} produto(s) ativo(s) de {draft.product_count}</span>
                  </div>
                  <button
                    type="button"
                    className="crz-button crz-button--primary crz-button--sm"
                    disabled={busy}
                    onClick={() => void save()}
                  >
                    {busy ? "Salvando..." : "Salvar categoria"}
                  </button>
                </header>

                <div className="crz-cm-form">
                  <label>
                    <span>Nome</span>
                    <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value.slice(0, 100) })} />
                  </label>
                  <label>
                    <span>Slug</span>
                    <input value={draft.slug || ""} onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })} />
                  </label>
                  <label>
                    <span>Emoji</span>
                    <input value={draft.emoji || ""} onChange={(event) => setDraft({ ...draft, emoji: event.target.value.slice(0, 32) })} placeholder="🎮" />
                  </label>
                  <label>
                    <span>Ordem</span>
                    <input type="number" value={draft.sort_order} onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) })} />
                  </label>
                  <label>
                    <span>Cor da categoria</span>
                    <div className="crz-cm-color">
                      <input type="color" value={draft.accent_color || "#1687ff"} onChange={(event) => setDraft({ ...draft, accent_color: event.target.value })} />
                      <input value={draft.accent_color || ""} onChange={(event) => setDraft({ ...draft, accent_color: event.target.value })} placeholder="#1687FF" />
                    </div>
                  </label>
                  <label className="is-wide">
                    <span>Ícone / logo</span>
                    <input value={draft.icon_url || ""} onChange={(event) => setDraft({ ...draft, icon_url: event.target.value })} placeholder="/icons/... ou https://..." />
                  </label>
                  <label className="is-wide">
                    <span>Imagem de capa</span>
                    <input value={draft.image_url || ""} onChange={(event) => setDraft({ ...draft, image_url: event.target.value })} placeholder="/products/... ou https://..." />
                  </label>
                  <label className="is-wide">
                    <span>Descrição</span>
                    <textarea rows={4} value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value.slice(0, 1000) })} />
                  </label>
                </div>

                <div className="crz-cm-actions">
                  <button
                    type="button"
                    className={draft.active ? "is-on" : ""}
                    onClick={() => setDraft({ ...draft, active: !draft.active })}
                  >
                    <i /> {draft.active ? "Categoria visível" : "Categoria desativada"}
                  </button>
                  <a href="/categorias" target="_blank" rel="noreferrer">
                    Ver página pública ↗
                  </a>
                </div>

                <section className="crz-cm-preview">
                  <small>PREVIEW</small>
                  <article style={{ "--accent": draft.accent_color || "#1687ff" } as React.CSSProperties}>
                    <div>
                      {draft.image_url ? <img src={draft.image_url} alt="" /> : null}
                      <span>
                        {draft.icon_url ? <img src={draft.icon_url} alt="" /> : draft.emoji || "◆"}
                      </span>
                    </div>
                    <strong>{draft.name}</strong>
                    <p>{draft.description || "Adicione uma descrição para esta categoria."}</p>
                    <em>{draft.product_count} produto(s)</em>
                  </article>
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { NeonIcon, PageHeader } from "@/core/design-system";
import { VerifiedReviewFeed } from "./VerifiedReviewFeed";
import type { ReviewableProduct } from "./types";

export function ReviewsPage() {
  const [products, setProducts] = useState<ReviewableProduct[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedVersion, setFeedVersion] = useState(0);

  useEffect(() => {
    fetch("/api/reviews/eligible", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        setAuthenticated(payload.authenticated === true);
        const next = (payload.products || []) as ReviewableProduct[];
        setProducts(next);
        if (next[0]) {
          setSelectedId(next[0].id);
          setRating(next[0].currentRating || 5);
          setComment(next[0].currentComment || "");
        }
      })
      .finally(() => setLoadingProducts(false));
  }, []);

  const selected = useMemo(
    () => products.find((product) => product.id === selectedId) || null,
    [products, selectedId]
  );

  const chooseProduct = (id: string) => {
    setSelectedId(id);
    const product = products.find((item) => item.id === id);
    setRating(product?.currentRating || 5);
    setComment(product?.currentComment || "");
    setNotice(null);
  };

  const submit = async () => {
    if (!selectedId) return;
    setSaving(true);
    setNotice(null);

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: selectedId, rating, comment }),
    });

    const payload = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setNotice(payload?.error || "Não foi possível publicar sua avaliação.");
      return;
    }

    setNotice("Avaliação publicada com compra verificada.");
    setProducts((current) =>
      current.map((product) =>
        product.id === selectedId
          ? { ...product, currentRating: rating, currentComment: comment, reviewedAt: new Date().toISOString() }
          : product
      )
    );
    setFeedVersion((value) => value + 1);
  };

  return (
    <main className="crz-reviews-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY REVIEWS"
          title="Avaliações da comunidade"
          description="Feedback público com selo de compra verificada baseado em pedido e entitlement reais."
          actions={
            <a className="crz-button crz-button--secondary crz-button--sm" href="/">
              Voltar ao início
            </a>
          }
        />

        <section className="crz-reviews-grid">
          <div className="crz-reviews-public">
            <div className="crz-reviews-section-head">
              <div>
                <span>FEEDBACK REAL</span>
                <h2>Últimas avaliações</h2>
              </div>
              <NeonIcon name="verified" size={30} />
            </div>
            <VerifiedReviewFeed key={feedVersion} limit={60} />
          </div>

          <aside className="crz-reviews-compose">
            <span className="crz-reviews-compose__eyebrow">SUA EXPERIÊNCIA</span>
            <h2>Publicar avaliação</h2>
            <p>
              O selo de compra verificada só é liberado quando a sua conta possui um produto realmente comprado.
            </p>

            {loadingProducts ? (
              <div className="crz-review-compose-state">Carregando suas compras...</div>
            ) : !authenticated ? (
              <div className="crz-review-compose-state">
                <strong>Entre na sua conta</strong>
                <span>Faça login para consultar suas compras e publicar.</span>
                <a className="crz-button crz-button--primary crz-button--md" href="/login">Entrar</a>
              </div>
            ) : !products.length ? (
              <div className="crz-review-compose-state">
                <strong>Nenhuma compra avaliável</strong>
                <span>Quando uma compra for concluída, o produto aparecerá aqui.</span>
              </div>
            ) : (
              <>
                <label className="crz-reviews-field">
                  <span>Produto comprado</span>
                  <select value={selectedId} onChange={(event) => chooseProduct(event.target.value)}>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </label>

                <div className="crz-reviews-rating" aria-label="Nota">
                  {[1,2,3,4,5].map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={value <= rating ? "is-active" : ""}
                      onClick={() => setRating(value)}
                      aria-label={value + " estrelas"}
                    >★</button>
                  ))}
                </div>

                <label className="crz-reviews-field">
                  <span>Comentário</span>
                  <textarea
                    value={comment}
                    minLength={3}
                    maxLength={800}
                    placeholder="Conte como foi sua experiência..."
                    onChange={(event) => setComment(event.target.value.slice(0, 800))}
                  />
                  <small>{comment.length}/800</small>
                </label>

                <button
                  type="button"
                  className="crz-button crz-button--primary crz-button--lg"
                  disabled={saving || !selected}
                  onClick={() => void submit()}
                >
                  {saving ? "Publicando..." : selected?.currentRating ? "Atualizar avaliação" : "Publicar avaliação"}
                </button>

                {notice && <div className="crz-reviews-notice">{notice}</div>}
              </>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

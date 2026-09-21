"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicReview } from "./types";

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  if (!Number.isFinite(delta) || delta < 0) return "agora";
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return "há " + minutes + " min";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return "há " + hours + "h";
  const days = Math.floor(hours / 24);
  if (days < 30) return "há " + days + "d";
  return date.toLocaleDateString("pt-BR");
}

export function VerifiedReviewFeed({
  limit = 20,
  productId,
  compact = false,
}: {
  limit?: number;
  productId?: string;
  compact?: boolean;
}) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (productId) params.set("productId", productId);
    return "/api/reviews?" + params.toString();
  }, [limit, productId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar as avaliações.");
        return payload.reviews as PublicReview[];
      })
      .then((next) => {
        if (!controller.signal.aborted) setReviews(next);
      })
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [url]);

  if (loading) {
    return (
      <div className={"crz-review-feed-state " + (compact ? "is-compact" : "")}>
        <span className="crz-spinner" aria-hidden="true" />
        <p>Carregando avaliações verificadas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={"crz-review-feed-state " + (compact ? "is-compact" : "")}>
        <strong>Não foi possível carregar as avaliações</strong>
        <p>{error}</p>
      </div>
    );
  }

  if (!reviews.length) {
    return (
      <div className={"crz-review-feed-state " + (compact ? "is-compact" : "")}>
        <strong>Ainda não há avaliações publicadas</strong>
        <p>As avaliações aparecem aqui depois de compras verificadas.</p>
      </div>
    );
  }

  return (
    <div className={"crz-review-feed " + (compact ? "is-compact" : "")}>
      {reviews.map((review) => (
        <article className="crz-review-card" key={review.id}>
          <div className="crz-review-card__avatar" aria-hidden="true">
            {review.avatarUrl ? <img src={review.avatarUrl} alt="" /> : review.username.slice(0, 1).toUpperCase()}
          </div>

          <div className="crz-review-card__body">
            <div className="crz-review-card__meta">
              <strong>{review.username}</strong>
              {review.verified && <span>✓ Compra verificada</span>}
              <time>{formatRelativeTime(review.createdAt)}</time>
            </div>

            <div className="crz-review-card__product">{review.productName}</div>

            <div className="crz-review-card__stars" aria-label={review.rating + " de 5 estrelas"}>
              {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
            </div>

            {review.comment && <p>{review.comment}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

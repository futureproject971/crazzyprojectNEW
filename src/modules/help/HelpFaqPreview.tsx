"use client";

import { useEffect, useState } from "react";
import type { HelpFaq } from "./types";

export function HelpFaqPreview({
  query,
  limit = 5,
}: {
  query?: string;
  limit?: number;
}) {
  const [items, setItems] = useState<HelpFaq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      limit: String(limit),
    });
    if (query) params.set("q", query);

    fetch("/api/help?" + params.toString(), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error("HELP_LOAD_FAILED");
        return payload;
      })
      .then(payload => {
        if (!controller.signal.aborted) setItems(payload.faqs || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [limit, query]);

  if (loading) {
    return <div className="crz-help-preview-state">Carregando perguntas...</div>;
  }

  if (!items.length) {
    return (
      <div className="crz-help-preview-state">
        <span>Nenhuma resposta direta encontrada.</span>
        <a href="/help">Pesquisar na Central de Ajuda</a>
      </div>
    );
  }

  return (
    <div className="crz-help-faq-list">
      {items.map(item => (
        <details key={item.id}>
          <summary>
            <span>{item.question}</span>
            <b>+</b>
          </summary>
          <div>
            <small>{item.category}</small>
            <p>{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}

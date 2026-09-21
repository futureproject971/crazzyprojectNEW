"use client";

import { NeonIcon } from "@/core/design-system";

export default function NewsError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-discovery crz-discovery-state-page">
      <section className="crz-discovery-state-card" role="alert">
        <NeonIcon name="lightning" size={46} />
        <h2>Não deu para carregar esta área</h2>
        <p>O visual está protegido. Tente carregar a página novamente.</p>
        <button type="button" onClick={reset}>Tentar novamente</button>
      </section>
    </main>
  );
}

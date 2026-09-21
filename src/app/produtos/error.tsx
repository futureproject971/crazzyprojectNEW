"use client";

import { ErrorState } from "@/core/design-system";

export default function ProductsError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-catalog crz-catalog-state-page">
      <ErrorState
        title="O catálogo não carregou"
        description="O módulo foi preservado. Tente novamente."
        onRetry={reset}
      />
    </main>
  );
}

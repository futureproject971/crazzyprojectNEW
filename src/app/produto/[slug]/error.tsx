"use client";

import { ErrorState } from "@/core/design-system";

export default function ProductError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-product-view crz-product-state-page">
      <ErrorState
        title="O produto não carregou"
        description="A página está preservada. Tente novamente."
        onRetry={reset}
      />
    </main>
  );
}

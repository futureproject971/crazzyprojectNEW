"use client";

import { ErrorState } from "@/core/design-system";

export default function CartError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-cart-page crz-cart-route-state">
      <ErrorState
        title="O carrinho não carregou"
        description="Seus itens continuam salvos localmente. Tente abrir novamente."
        onRetry={reset}
      />
    </main>
  );
}

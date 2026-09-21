"use client";

import { ErrorState } from "@/core/design-system";

export default function CheckoutError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-checkout-page crz-cart-route-state">
      <ErrorState
        title="O checkout não carregou"
        description="Nenhuma cobrança foi criada. Tente abrir novamente."
        onRetry={reset}
      />
    </main>
  );
}

"use client";

import { ErrorState } from "@/core/design-system";

export default function ComboError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-combo-page crz-cart-route-state">
      <ErrorState
        title="O Combo Builder não carregou"
        description="Tente novamente. Seu carrinho não foi apagado."
        onRetry={reset}
      />
    </main>
  );
}

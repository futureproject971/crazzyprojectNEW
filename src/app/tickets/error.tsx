"use client";

import { ErrorState } from "@/core/design-system";

export default function TicketsError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-support-page crz-support-state">
      <ErrorState
        title="O Support não carregou"
        description="Sua sessão continua protegida. Tente novamente."
        onRetry={reset}
      />
    </main>
  );
}

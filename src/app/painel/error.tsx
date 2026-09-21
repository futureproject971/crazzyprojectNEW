"use client";

import { ErrorState } from "@/core/design-system";

export default function ClientHubError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-hub-page crz-hub-state">
      <ErrorState
        title="Seu painel não carregou"
        description="Sua sessão continua protegida. Tente abrir o painel novamente."
        onRetry={reset}
      />
    </main>
  );
}

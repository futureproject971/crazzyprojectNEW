"use client";

import { ErrorState } from "@/core/design-system";

export default function AccountDetailError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-account-detail crz-account-detail--state">
      <ErrorState
        title="Não foi possível abrir a conta"
        description="Tente novamente ou volte ao market."
        onRetry={reset}
      />
    </main>
  );
}

"use client";

import { ErrorState } from "@/core/design-system";

export default function AccountsError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-accounts-market crz-accounts-state">
      <ErrorState
        title="O Accounts Market não carregou"
        description="O restante da CRAZZY PROJECT continua intacto. Tente novamente."
        onRetry={reset}
      />
    </main>
  );
}

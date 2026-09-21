"use client";

import { ErrorState } from "@/core/design-system";

export default function CommunityError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-community-page crz-community-state">
      <ErrorState
        title="A Community não carregou"
        description="Sua sessão continua protegida. Tente novamente."
        onRetry={reset}
      />
    </main>
  );
}

"use client";

import { ErrorState } from "@/core/design-system";

export default function ProfileError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-profile-page crz-profile-state">
      <ErrorState
        title="Seu perfil não carregou"
        description="Sua conta continua protegida. Tente abrir o perfil novamente."
        onRetry={reset}
      />
    </main>
  );
}

"use client";

import { ErrorState } from "@/core/design-system";

export default function LibraryError({ reset }: { reset: () => void }) {
  return (
    <main className="crz-library-page crz-library-state">
      <ErrorState
        title="A Library não carregou"
        description="Nenhum conteúdo foi revelado. Tente abrir novamente."
        onRetry={reset}
      />
    </main>
  );
}

import { LoadingState } from "@/core/design-system";

export default function NewsLoading() {
  return (
    <main className="crz-discovery crz-discovery-state-page">
      <section className="crz-discovery-state-card" aria-live="polite">
        <LoadingState label="Carregando novidades da CRAZZY PROJECT..." />
      </section>
    </main>
  );
}

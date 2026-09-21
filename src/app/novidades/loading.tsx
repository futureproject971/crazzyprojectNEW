import { Spinner } from "@/core/design-system";

export default function NewsLoading() {
  return (
    <main className="crz-discovery crz-discovery-state-page">
      <section className="crz-discovery-state-card" aria-live="polite">
        <Spinner />
        <h2>Carregando novidades</h2>
        <p>Preparando os destaques e categorias da CRAZZY PROJECT.</p>
      </section>
    </main>
  );
}

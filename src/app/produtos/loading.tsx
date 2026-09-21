import { LoadingState } from "@/core/design-system";

export default function ProductsLoading() {
  return (
    <main className="crz-catalog crz-catalog-state-page">
      <LoadingState label="Carregando catálogo da CRAZZY PROJECT..." />
    </main>
  );
}

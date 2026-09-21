import { LoadingState } from "@/core/design-system";

export default function ProductLoading() {
  return (
    <main className="crz-product-view crz-product-state-page">
      <LoadingState label="Carregando produto..." />
    </main>
  );
}

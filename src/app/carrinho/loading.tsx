import { LoadingState } from "@/core/design-system";

export default function CartLoading() {
  return (
    <main className="crz-cart-page crz-cart-route-state">
      <LoadingState label="Abrindo seu carrinho..." />
    </main>
  );
}

import { LoadingState } from "@/core/design-system";

export default function CheckoutLoading() {
  return (
    <main className="crz-checkout-page crz-cart-route-state">
      <LoadingState label="Preparando checkout seguro..." />
    </main>
  );
}

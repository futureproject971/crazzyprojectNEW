import { AppShell } from "@/core/app-shell";
import { EmptyState, Button, NeonIcon } from "@/core/design-system";

export default function ProductNotFound() {
  return (
    <AppShell mode="visitor" activeNav="products" cartCount={0}>
      <main className="crz-product-view crz-product-state-page">
        <EmptyState
          title="Produto não encontrado"
          description="Esse produto não existe no catálogo atual ou foi removido."
          icon={<NeonIcon name="cube" size={30} />}
          action={
            <a href="/produtos">
              <Button variant="secondary">Voltar para produtos</Button>
            </a>
          }
        />
      </main>
    </AppShell>
  );
}

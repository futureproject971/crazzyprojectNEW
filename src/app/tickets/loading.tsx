import { LoadingState } from "@/core/design-system";

export default function TicketsLoading() {
  return (
    <main className="crz-support-page crz-support-state">
      <LoadingState label="Carregando Support..." />
    </main>
  );
}

import { LoadingState } from "@/core/design-system";

export default function ClientHubLoading() {
  return (
    <main className="crz-hub-page crz-hub-state">
      <LoadingState label="Carregando seu Client Hub..." />
    </main>
  );
}

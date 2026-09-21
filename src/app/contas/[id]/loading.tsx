import { LoadingState } from "@/core/design-system";

export default function AccountDetailLoading() {
  return (
    <main className="crz-account-detail crz-account-detail--state">
      <LoadingState label="Carregando conta..." />
    </main>
  );
}

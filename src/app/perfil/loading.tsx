import { LoadingState } from "@/core/design-system";

export default function ProfileLoading() {
  return (
    <main className="crz-profile-page crz-profile-state">
      <LoadingState label="Carregando seu perfil..." />
    </main>
  );
}

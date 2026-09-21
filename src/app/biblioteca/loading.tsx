import { LoadingState } from "@/core/design-system";

export default function LibraryLoading() {
  return (
    <main className="crz-library-page crz-library-state">
      <LoadingState label="Abrindo sua Library..." />
    </main>
  );
}

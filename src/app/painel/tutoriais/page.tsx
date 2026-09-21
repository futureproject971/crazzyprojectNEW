import { AppShell } from "@/core/app-shell";
import { AcademyPage } from "@/modules/academy";

export default function ClientTutorialsRoute() {
  return (
    <AppShell mode="client">
      <AcademyPage onlyUnlocked />
    </AppShell>
  );
}

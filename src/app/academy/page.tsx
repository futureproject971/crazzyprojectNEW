import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { AcademyPage } from "@/modules/academy";

export const metadata: Metadata = {
  title: "CRAZZY ACADEMY | CRAZZY PROJECT",
  description: "Tutoriais públicos e guias liberados por produto.",
};

export default function AcademyRoute() {
  return (
    <AppShell mode="visitor">
      <AcademyPage />
    </AppShell>
  );
}

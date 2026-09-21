import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { MtSoundsPage } from "@/modules/mtsounds";

export const metadata: Metadata = {
  title: "MT Sounds | CRAZZY PROJECT",
  description: "Ferramenta gratuita parceira MT Sounds dentro da CRAZZY PROJECT.",
};

export default function MtSoundsRoute() {
  return (
    <AppShell mode="visitor" activeNav="mtsounds">
      <MtSoundsPage />
    </AppShell>
  );
}

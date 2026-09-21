import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { ProfilePage } from "@/modules/profile";

export const metadata: Metadata = {
  title: "Meu Perfil | CRAZZY PROJECT",
  description: "Seu perfil, badges, cargos e conexão Discord na CRAZZY PROJECT.",
};

export default function ProfileRoute() {
  return (
    <AppShell mode="client">
      <ProfilePage />
    </AppShell>
  );
}

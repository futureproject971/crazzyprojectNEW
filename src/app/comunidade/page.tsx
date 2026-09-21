import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/core/app-shell";
import { getVerifiedUser } from "@/lib/supabase/server";
import { CommunityPage } from "@/modules/community";

export const metadata: Metadata = {
  title: "Comunidade | CRAZZY PROJECT",
  description: "Chat privado da comunidade CRAZZY PROJECT.",
};

export default async function CommunityRoute() {
  const user = await getVerifiedUser();
  if (!user) redirect("/login?next=%2Fcomunidade");

  return (
    <AppShell mode="client" activeNav="community">
      <CommunityPage />
    </AppShell>
  );
}

import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { AcademyTutorialPage } from "@/modules/academy";

export const metadata: Metadata = {
  title: "Tutorial | CRAZZY ACADEMY",
};

export default async function AcademyTutorialRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <AppShell mode="visitor">
      <AcademyTutorialPage slug={slug} />
    </AppShell>
  );
}

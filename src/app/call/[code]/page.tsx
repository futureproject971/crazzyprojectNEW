import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { CallExperience } from "@/modules/call";

export const metadata: Metadata = {
  title: "Sala | CRAZZY CALL",
};

export default async function CallRoomRoute({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <div className="crz-call-focused">
      <CallExperience code={decodeURIComponent(code).toUpperCase()} />
    </div>
  );
}

import type { Metadata } from "next";
import { DiscordGuildGatePage } from "@/modules/auth/DiscordGuildGatePage";

export const metadata: Metadata = {
  title: "Entre no Discord | CRAZZY PROJECT",
  description: "Entre no servidor oficial para concluir o acesso à CRAZZY PROJECT.",
};

export default async function DiscordGuildGateRoute({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const query=await searchParams;
  const nextPath=query.next&&query.next.startsWith("/")&&!query.next.startsWith("//")?query.next:"/painel";
  return <DiscordGuildGatePage nextPath={nextPath}/>;
}

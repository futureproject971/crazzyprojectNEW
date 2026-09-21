import { AppShell } from "@/core/app-shell";
import { HomePage } from "@/modules/home";

export default function Home() {
  return (
    <AppShell mode="visitor" activeNav="home" cartCount={0}>
      <HomePage />
    </AppShell>
  );
}

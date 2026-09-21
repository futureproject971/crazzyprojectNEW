import { AppShell } from "../AppShell";

export function M01ShellCompileFixture() {
  return (
    <>
      <AppShell mode="visitor" activeNav="home" cartCount={2}>
        <div>Visitor shell</div>
      </AppShell>

      <AppShell mode="client" activeNav="community" userName="Meu Painel">
        <div>Client shell</div>
      </AppShell>

      <AppShell mode="admin" activeNav="admin" userName="Meu Admin">
        <div>Admin shell</div>
      </AppShell>
    </>
  );
}

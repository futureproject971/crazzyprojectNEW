import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { Panel, NeonIcon } from "@/core/design-system";

export const metadata: Metadata = {
  title: "Recuperar acesso | CRAZZY PROJECT",
};

export default function ResetPasswordPage() {
  return (
    <AppShell mode="visitor">
      <main className="crz-auth-recovery">
        <Panel className="crz-auth-recovery__panel">
          <NeonIcon name="shield" size={36} />
          <h1>Recuperar acesso</h1>
          <p>
            A CRAZZY PROJECT usa login social. Não existe uma senha CRAZZY para
            redefinir: entre novamente com o mesmo Discord ou Google usado na conta.
          </p>
          <a className="crz-button crz-button--primary crz-button--md" href="/login">
            Voltar ao login
          </a>
        </Panel>
      </main>
    </AppShell>
  );
}

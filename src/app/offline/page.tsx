import { AppShell } from "@/core/app-shell";

export default function OfflinePage() {
  return (
    <AppShell mode="visitor" activeNav="home">
      <main className="crz-offline">
        <div>
          <img src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT" />
          <small>M42 • PWA</small>
          <h1>Você está offline.</h1>
          <p>Assim que a conexão voltar, recarregue a página para sincronizar dados, login, compras e suporte.</p>
          <a className="crz-button crz-button--primary crz-button--md" href="/">Tentar novamente</a>
        </div>
      </main>
    </AppShell>
  );
}

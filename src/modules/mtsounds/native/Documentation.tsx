import { Braces, Code2, Download } from "./icons";

export default function Docs(){
  const responseExample='{"results":[{"id":"videoId","title":"Faixa","channel":"Canal","thumbnail":"https://..."}],"source":"youtube-api | youtube-public"}';
  return <section className="page wrap">
    <span className="eyebrow">API / ROTAS ATUAIS</span>
    <h1>Integre o que já <span>funciona hoje.</span></h1>
    <p className="lead">Estas são as rotas usadas pelo próprio site. O contrato ainda pode evoluir enquanto a plataforma cresce.</p>
    <div className="docs-grid">
      <article className="glass doc"><Code2/><h3>Buscar no YouTube</h3><code>GET /api/youtube/search?q=nome</code><pre>{responseExample}</pre></article>
      <article className="glass doc"><Download/><h3>Abrir downloader</h3><code>GET /api/downloader?url=https://youtube.com/...</code><p>Valida o endereço informado e encaminha a música para o fluxo de download configurado no projeto.</p></article>
      <article className="glass doc"><Braces/><h3>Próxima etapa</h3><p>Login Discord, histórico pessoal, projetos salvos e galeria da comunidade entram na próxima fase da MTSound&apos;s.</p></article>
    </div>
  </section>;
}

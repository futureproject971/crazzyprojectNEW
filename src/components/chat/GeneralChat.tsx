import { chatMessages } from "@/data/home";
import { NeonSectionIcon } from "@/components/ui/NeonSectionIcon";

function Avatar({ seed, tone }: { seed: number; tone: string }) {
  return <span className={`chat-avatar chat-avatar--${tone}`} aria-hidden="true">{String(seed).padStart(2, "0")}</span>;
}

export function GeneralChat() {
  return (
    <section className="social-panel chat-panel" id="comunidade" aria-labelledby="chat-title">
      <header className="panel-heading chat-heading">
        <div className="panel-heading-main">
          <NeonSectionIcon src="/icons/neon-v2/chat.svg" />
          <div>
            <h2 id="chat-title">Chat Geral</h2>
            <p>Converse com a comunidade. Todos são bem-vindos!</p>
          </div>
        </div>
        <span className="online-counter"><i /> 1.482 online</span>
      </header>

      <div className="chat-list custom-scroll">
        {chatMessages.map((item) => (
          <article className="chat-row" key={item.id}>
            <Avatar seed={item.id} tone={item.tone} />
            <div className="chat-bubble">
              <div className="chat-meta">
                <strong>{item.name}</strong>
                <span>{item.time}</span>
              </div>
              <p>{item.message}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="chat-compose">
        <a className="chat-input-shell chat-preview-link" href="/comunidade">
          <span className="compose-mini" aria-hidden="true">⊙</span>
          <span>Entrar no Chat Geral...</span>
          <span className="compose-mini" aria-hidden="true">☺</span>
        </a>
        <a className="send-button chat-preview-send" href="/comunidade" aria-label="Abrir comunidade">
          <span
            className="send-icon"
            style={{ WebkitMaskImage: 'url("/icons/send.svg")', maskImage: 'url("/icons/send.svg")' }}
          />
        </a>
      </div>

      <div className="chat-reactions" aria-hidden="true">
        <span>🔥</span><span>💙</span><span>👍</span><span>😂</span><span>🎮</span><span>👀</span><span>💯</span>
      </div>
    </section>
  );
}

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
          <NeonSectionIcon src="/icons/message-circle.svg" />
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
        <div className="chat-input-shell">
          <button type="button" className="compose-mini" aria-label="Adicionar">⊙</button>
          <input aria-label="Mensagem" placeholder="Digite sua mensagem..." />
          <button type="button" className="compose-mini" aria-label="Emoji">☺</button>
        </div>
        <button type="button" className="send-button" aria-label="Enviar">
          <span
            className="send-icon"
            style={{ WebkitMaskImage: 'url("/icons/send.svg")', maskImage: 'url("/icons/send.svg")' }}
          />
        </button>
      </div>

      <div className="chat-reactions" aria-hidden="true">
        <span>🔥</span><span>💙</span><span>👍</span><span>😂</span><span>🎮</span><span>👀</span><span>💯</span>
      </div>
    </section>
  );
}

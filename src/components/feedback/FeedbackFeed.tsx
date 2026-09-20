import { feedbacks } from "@/data/home";
import { NeonSectionIcon } from "@/components/ui/NeonSectionIcon";

function Avatar({ seed }: { seed: number }) {
  return <span className={`mock-avatar mock-avatar--${seed % 5}`} aria-hidden="true" />;
}

export function FeedbackFeed() {
  return (
    <section className="social-panel feedback-panel" id="feedbacks" aria-labelledby="feedback-title">
      <header className="panel-heading">
        <div className="panel-heading-main">
          <NeonSectionIcon src="/icons/star.svg" />
          <div>
            <h2 id="feedback-title">Feedback de Clientes</h2>
            <p>Apenas clientes podem ver e publicar feedbacks.</p>
          </div>
        </div>
        <span className="exclusive-badge">EXCLUSIVO</span>
      </header>

      <div className="feedback-list custom-scroll">
        {feedbacks.map((item) => (
          <article className="feedback-entry" key={item.id}>
            <Avatar seed={item.id} />
            <div className="feedback-body">
              <div className="feedback-meta">
                <strong>{item.name}</strong>
                {item.verified && <span className="verified-dot">● Cliente Verificado</span>}
                <span>{item.time}</span>
              </div>
              <p>{item.message}</p>
              <div className="feedback-media">
                <span />
                <span />
                <span />
              </div>
              <div className="feedback-reactions">
                <span>♥ {item.reactions.heart}</span>
                <span>🔥 {item.reactions.fire}</span>
                <span>▢ {item.reactions.comments}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <footer className="panel-login-gate">
        <div className="login-gate-copy">
          <span className="gate-lock">▣</span>
          <span>Faça parte de milhares de clientes satisfeitos.</span>
        </div>
        <button type="button">Fazer Login para Publicar</button>
      </footer>
    </section>
  );
}

import { ticketCategories, whyCrazzy } from "@/data/home";
import { NeonSectionIcon } from "@/components/ui/NeonSectionIcon";

function MaskIcon({ src }: { src: string }) {
  return (
    <span
      className="ticket-mask-icon"
      aria-hidden="true"
      style={{ WebkitMaskImage: `url("${src}")`, maskImage: `url("${src}")` }}
    />
  );
}

export function TicketPanel() {
  return (
    <div className="right-social-stack" id="ticket">
      <section className="social-panel ticket-panel" aria-labelledby="ticket-title">
        <header className="panel-heading ticket-heading">
          <div className="panel-heading-main">
            <NeonSectionIcon src="/icons/headset.svg" />
            <div>
              <h2 id="ticket-title">Abrir Ticket</h2>
              <p>Precisa de ajuda? Nossa equipe está pronta para te atender.</p>
            </div>
          </div>
          <button type="button" className="open-ticket-button">+ Abrir Ticket</button>
        </header>

        <p className="ticket-label">Escolha uma categoria:</p>
        <div className="ticket-grid">
          {ticketCategories.map((item) => (
            <button type="button" className="ticket-category" key={item.title}>
              <MaskIcon src={item.icon} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="social-panel why-panel" aria-labelledby="why-title">
        <header className="why-heading">
          <NeonSectionIcon src="/icons/crown.svg" />
          <h2 id="why-title">Por que escolher a CRAZZY?</h2>
        </header>
        <div className="why-list">
          {whyCrazzy.map((item) => (
            <div className="why-item" key={item.title}>
              <MaskIcon src={item.icon} />
              <div>
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

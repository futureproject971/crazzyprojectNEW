"use client";

import { NeonSectionIcon } from "@/components/ui/NeonSectionIcon";
import { VerifiedReviewFeed } from "@/modules/reviews";

export function FeedbackFeed() {
  return (
    <section className="social-panel feedback-panel" id="feedbacks" aria-labelledby="feedback-title">
      <header className="panel-heading">
        <div className="panel-heading-main">
          <NeonSectionIcon src="/icons/neon-v2/feedback.svg" />
          <div>
            <h2 id="feedback-title">Feedback de Clientes</h2>
            <p>Avaliações públicas de clientes com compra verificada.</p>
          </div>
        </div>
        <span className="exclusive-badge">VERIFICADO</span>
      </header>

      <div className="feedback-list custom-scroll">
        <VerifiedReviewFeed limit={12} compact />
      </div>

      <footer className="panel-login-gate">
        <div className="login-gate-copy">
          <span className="gate-lock">✓</span>
          <span>Comprou? Publique sua experiência com selo verificado.</span>
        </div>
        <a className="crz-button crz-button--primary crz-button--sm" href="/feedbacks">
          Ver e publicar avaliações
        </a>
      </footer>
    </section>
  );
}

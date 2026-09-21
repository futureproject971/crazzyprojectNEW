"use client";

import { useEffect, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";

const PARTNER_URL = "https://mtsounds.vercel.app/";

export function MtSoundsPage() {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="crz-mtsounds-page">
      <div className="crz-container crz-mtsounds-container">
        <PageHeader
          eyebrow="PARCEIRO CRAZZY"
          title="MT Sounds"
          description="Ferramenta gratuita de parceiro integrada à experiência da CRAZZY PROJECT."
          actions={
            <div className="crz-mtsounds-actions">
              <Badge tone="green">GRÁTIS</Badge>
              <a
                className="crz-button crz-button--secondary crz-button--sm"
                href={PARTNER_URL}
                target="_blank"
                rel="noreferrer"
              >
                Abrir em nova aba
              </a>
            </div>
          }
        />

        <section className="crz-mtsounds-notice">
          <NeonIcon name="community" size={29} />
          <div>
            <strong>Ferramenta de parceiro</strong>
            <span>
              A marca MT Sounds é preservada. Este recurso é gratuito e não exige compra na CRAZZY PROJECT.
            </span>
          </div>
        </section>

        <section className="crz-mtsounds-frame-shell">
          <header>
            <div>
              <i className="is-red" />
              <i className="is-yellow" />
              <i className="is-green" />
            </div>
            <span>MT SOUNDS • PARTNER APP</span>
            <strong>{loaded ? "ONLINE" : "CONECTANDO..."}</strong>
          </header>

          <div className="crz-mtsounds-frame-wrap">
            {!loaded && (
              <div className="crz-mtsounds-loading">
                <span className="crz-spinner" />
                <strong>Carregando MT Sounds</strong>
                <p>
                  A ferramenta está sendo aberta dentro da CRAZZY PROJECT.
                </p>
                {slow && (
                  <a
                    className="crz-button crz-button--secondary crz-button--sm"
                    href={PARTNER_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Se não carregar, abrir em nova aba
                  </a>
                )}
              </div>
            )}

            <iframe
              className={loaded ? "is-loaded" : ""}
              src={PARTNER_URL}
              title="MT Sounds"
              onLoad={() => setLoaded(true)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              allow="autoplay; clipboard-read; clipboard-write"
              referrerPolicy="no-referrer"
            />
          </div>
        </section>

        <section className="crz-mtsounds-footer-note">
          <NeonIcon name="shield" size={25} />
          <div>
            <strong>Integração isolada</strong>
            <span>
              A aplicação parceira roda em uma área separada do restante da conta CRAZZY.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}

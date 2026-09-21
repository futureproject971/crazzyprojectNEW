"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  NeonIcon,
  Panel,
  SectionTitle,
} from "@/core/design-system";
import type { AccountsMarketItem } from "./types";

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="crz-account-detail__info">
      <span>{label}</span>
      <strong>{value ?? "Não informado"}</strong>
    </div>
  );
}

export function AccountDetailView({ id }: { id: string }) {
  const [item, setItem] = useState<AccountsMarketItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);

    fetch("/api/accounts/" + encodeURIComponent(id), { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Falha ao carregar conta.");
        return payload.item as AccountsMarketItem;
      })
      .then(setItem)
      .catch((requestError: Error) =>
        setError(requestError.message || "Falha ao carregar conta.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  if (loading) {
    return (
      <main className="crz-account-detail crz-account-detail--state">
        <LoadingState label="Carregando detalhes da conta..." />
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="crz-account-detail crz-account-detail--state">
        <ErrorState
          title="A conta não carregou"
          description={error ?? "Conta não encontrada."}
          onRetry={load}
        />
      </main>
    );
  }

  return (
    <main className="crz-account-detail">
      <div className="crz-container">
        <nav className="crz-account-detail__breadcrumb" aria-label="Breadcrumb">
          <a href="/">Início</a>
          <span>›</span>
          <a href="/contas">Contas</a>
          <span>›</span>
          <span aria-current="page">#{item.id}</span>
        </nav>

        <section className="crz-account-detail__hero">
          <div className="crz-account-detail__art">
            <div className="crz-account-detail__orb" aria-hidden="true" />
            <NeonIcon name="gamepad" size={118} />
            <span>CRAZZY ACCOUNTS</span>
          </div>

          <div className="crz-account-detail__summary">
            <div className="crz-account-detail__badges">
              <Badge tone="green">LZT LIVE</Badge>
              <Badge tone={item.rank ? "blue" : "neutral"}>
                {item.rank ?? "RANK N/D"}
              </Badge>
            </div>

            <small>CONTA #{item.id}</small>
            <h1>{item.title}</h1>
            <p>
              Dados consultados pela integração LZT existente. Credenciais e compra não são
              expostas nesta página pública.
            </p>

            <div className="crz-account-detail__quick">
              <Info label="Região" value={item.region} />
              <Info label="Nível" value={item.level} />
              <Info label="Skins" value={item.skinsCount} />
              <Info label="Facas" value={item.knivesCount} />
            </div>

            <div className="crz-account-detail__price-guard">
              <NeonIcon name="shield" size={30} />
              <div>
                <small>VALOR COMERCIAL</small>
                <strong>Preço final protegido</strong>
                <span>
                  O markup/conversão não é calculado no navegador. Compra entra nos módulos
                  M07/M08 e fulfillment no M43.
                </span>
              </div>
            </div>

            <div className="crz-account-detail__actions">
              <Button size="lg" disabled leadingIcon={<NeonIcon name="lightning" size={20} />}>
                Compra ainda não liberada
              </Button>
              <a href="/contas">← Voltar ao market</a>
            </div>
          </div>
        </section>

        <section className="crz-account-detail__content">
          <Panel className="crz-account-detail__panel">
            <SectionTitle
              icon={<NeonIcon name="verified" size={28} />}
              title="Detalhes da conta"
              description="Campos normalizados do provider sem credenciais sensíveis."
            />

            <div className="crz-account-detail__info-grid">
              <Info label="Rank atual" value={item.rank} />
              <Info label="Valor do rank" value={item.rankValue} />
              <Info label="Agentes" value={item.agentsCount} />
              <Info label="Inventário" value={item.inventoryValue} />
              <Info label="Valorant Points" value={item.vp} />
              <Info label="Radiant Points" value={item.rp} />
              <Info label="Tipo de e-mail" value={item.emailType} />
              <Info label="País" value={item.country} />
            </div>
          </Panel>

          <Panel className="crz-account-detail__panel crz-account-detail__panel--security">
            <SectionTitle
              icon={<NeonIcon name="shield" size={28} />}
              title="Regras de segurança"
              description="M06 é consulta e apresentação. Compra e entrega são módulos separados."
            />

            <ul>
              <li>Token LZT permanece somente no backend existente.</li>
              <li>O browser não recebe endpoint de fast-buy.</li>
              <li>Preço comercial não é confiado ao payload do cliente.</li>
              <li>Entrega de conta só ocorrerá pelo Fulfillment Engine após pagamento confirmado.</li>
            </ul>
          </Panel>
        </section>
      </div>
    </main>
  );
}

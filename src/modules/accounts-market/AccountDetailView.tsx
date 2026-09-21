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
import type { AccountsMarketGame, AccountsMarketItem } from "./types";

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null;
}) {
  const rendered = typeof value === "boolean" ? (value ? "Sim" : "Não") : (value ?? "Não informado");
  return (
    <div className="crz-account-detail__info">
      <span>{label}</span>
      <strong>{String(rendered)}</strong>
    </div>
  );
}

function detailsFor(item: AccountsMarketItem) {
  if (item.game === "lol") {
    return [
      ["Rank", item.rank],
      ["Região", item.region],
      ["Nível", item.level],
      ["Skins", item.skinsCount],
      ["Campeões", item.championsCount],
      ["País", item.country],
    ] as const;
  }
  if (item.game === "fortnite") {
    return [
      ["Região", item.region],
      ["Nível", item.level],
      ["Skins", item.skinsCount],
      ["V-Bucks", item.vbucks],
      ["País", item.country],
    ] as const;
  }
  if (item.game === "minecraft") {
    return [
      ["Nível Hypixel", item.level],
      ["Capas", item.capesCount],
      ["Minecoins", item.minecoins],
      ["Java", item.java],
      ["Bedrock", item.bedrock],
      ["Dungeons", item.dungeons],
      ["Legends", item.legends],
    ] as const;
  }
  return [
    ["Rank atual", item.rank],
    ["Valor do rank", item.rankValue],
    ["Região", item.region],
    ["Nível", item.level],
    ["Skins", item.skinsCount],
    ["Facas", item.knivesCount],
    ["Agentes", item.agentsCount],
    ["Inventário", item.inventoryValue],
    ["Valorant Points", item.vp],
    ["Radiant Points", item.rp],
    ["Tipo de e-mail", item.emailType],
    ["País", item.country],
  ] as const;
}

export function AccountDetailView({
  id,
  game,
}: {
  id: string;
  game: AccountsMarketGame;
}) {
  const [item, setItem] = useState<AccountsMarketItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credentialMissing, setCredentialMissing] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    setCredentialMissing(false);

    fetch("/api/accounts/" + encodeURIComponent(id) + "?game=" + game, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          setCredentialMissing(payload?.code === "LZT_CREDENTIAL_MISSING");
          throw new Error(payload?.error || "Falha ao carregar conta.");
        }
        return payload.item as AccountsMarketItem;
      })
      .then(setItem)
      .catch((requestError: Error) => setError(requestError.message || "Falha ao carregar conta."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id, game]);

  if (loading) {
    return <main className="crz-account-detail crz-account-detail--state"><LoadingState label="Carregando detalhes da conta..." /></main>;
  }

  if (error || !item) {
    return (
      <main className="crz-account-detail crz-account-detail--state">
        <ErrorState
          title={credentialMissing ? "Credencial do provider pendente" : "A conta não carregou"}
          description={credentialMissing ? "O detalhe seguro já está pronto, mas a consulta ao provider aguarda configuração da credencial LZT." : (error ?? "Conta não encontrada.")}
          onRetry={load}
        />
      </main>
    );
  }

  const details = detailsFor(item);

  return (
    <main className="crz-account-detail">
      <div className="crz-container">
        <nav className="crz-account-detail__breadcrumb" aria-label="Breadcrumb">
          <a href="/">Início</a><span>›</span><a href="/contas">Contas</a><span>›</span><span aria-current="page">#{item.id}</span>
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
              <Badge tone={item.rank ? "blue" : "neutral"}>{item.rank ?? item.game.toUpperCase()}</Badge>
            </div>
            <small>{item.game.toUpperCase()} • CONTA #{item.id}</small>
            <h1>{item.title}</h1>
            <p>Detalhe sanitizado pelo backend. O navegador não recebe token, credenciais da conta nem endpoint de compra.</p>

            <div className="crz-account-detail__quick">
              {details.slice(0, 4).map(([label, value]) => <Info key={label} label={label} value={value} />)}
            </div>

            <div className="crz-account-detail__price-guard">
              <NeonIcon name="shield" size={30} />
              <div>
                <small>VALOR COMERCIAL</small>
                <strong>Preço final protegido</strong>
                <span>Conversão RUB → BRL e markup não serão inventados. Compra entra depois em M07/M08 e entrega no M43.</span>
              </div>
            </div>

            <div className="crz-account-detail__actions">
              <Button size="lg" disabled leadingIcon={<NeonIcon name="lightning" size={20} />}>Compra ainda não liberada</Button>
              <a href="/contas">← Voltar ao market</a>
            </div>
          </div>
        </section>

        <section className="crz-account-detail__content">
          <Panel className="crz-account-detail__panel">
            <SectionTitle
              icon={<NeonIcon name="verified" size={28} />}
              title="Detalhes da conta"
              description="Somente campos explicitamente permitidos pelo adapter M06."
            />
            <div className="crz-account-detail__info-grid">
              {details.map(([label, value]) => <Info key={label} label={label} value={value} />)}
            </div>
          </Panel>

          <Panel className="crz-account-detail__panel crz-account-detail__panel--security">
            <SectionTitle
              icon={<NeonIcon name="shield" size={28} />}
              title="Regras de segurança"
              description="M06 consulta e apresenta. Compra e entrega são módulos separados."
            />
            <ul>
              <li>Token LZT permanece somente no backend.</li>
              <li>Detalhe público usa action sanitizada e read-only.</li>
              <li>O browser não recebe endpoint de fast-buy.</li>
              <li>Preço comercial não é confiado ao payload do cliente.</li>
              <li>Entrega só ocorrerá pelo Fulfillment Engine após pagamento confirmado.</li>
            </ul>
          </Panel>
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  NeonIcon,
  Panel,
  SectionTitle,
} from "@/core/design-system";
import { formatBrl } from "@/modules/cart/pricing";
import { useCart } from "@/modules/cart/CartProvider";
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
    ["Região", item.region],
    ["Nível", item.level],
    ["Skins", item.skinsCount],
    ["Facas", item.knivesCount],
    ["Agentes", item.agentsCount],
    ["Valor do inventário", item.inventoryValue],
    ["Valorant Points", item.vp],
    ["Radiant Points", item.rp],
    ["Tipo de e-mail", item.emailType],
    ["País", item.country],
  ] as const;
}

function gameName(game: AccountsMarketItem["game"]) {
  if (game === "lol") return "League of Legends";
  if (game === "fortnite") return "Fortnite";
  if (game === "minecraft") return "Minecraft";
  return "VALORANT";
}

export function AccountDetailView({
  id,
  game,
}: {
  id: string;
  game: AccountsMarketGame;
}) {
  const { addItem, openCart } = useCart();
  const [item, setItem] = useState<AccountsMarketItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);

    fetch("/api/accounts/" + encodeURIComponent(id) + "?game=" + game, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar esta conta.");
        return payload.item as AccountsMarketItem;
      })
      .then(setItem)
      .catch((requestError: Error) => setError(requestError.message || "Não foi possível carregar esta conta."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id, game]);

  const details = useMemo(() => item ? detailsFor(item) : [], [item]);

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
          description={error ?? "Esta conta não está mais disponível."}
          onRetry={load}
        />
      </main>
    );
  }

  const addAccountToCart = () => {
    addItem({
      key: "account:" + item.game + ":" + item.id,
      kind: "account",
      productId: "account-" + item.game + "-" + item.id,
      name: item.title,
      subtitle: gameName(item.game) + " • Conta #" + item.id,
      image: item.imageUrl ?? null,
      planId: "account",
      planCode: "account",
      planName: "Conta",
      durationLabel: "Entrega única",
      price: item.price,
      priceLabel: item.price != null ? formatBrl(item.price) : "A confirmar",
      category: "Contas",
      comboEligible: false,
      accountId: item.id,
      accountGame: item.game,
    });
    openCart();
  };

  return (
    <main className="crz-account-detail">
      <div className="crz-container">
        <nav className="crz-account-detail__breadcrumb" aria-label="Breadcrumb">
          <a href="/">Início</a><span>›</span><a href="/contas">Contas</a><span>›</span><span aria-current="page">#{item.id}</span>
        </nav>

        <section className="crz-account-detail__hero">
          <div className="crz-account-detail__art">
            {item.imageUrl ? <img className="crz-account-detail__cover" src={item.imageUrl} alt="" /> : null}
            <div className="crz-account-detail__art-overlay" />
            <div className="crz-account-detail__art-copy">
              <Badge tone="green">DISPONÍVEL</Badge>
              <strong>{gameName(item.game)}</strong>
              <span>Conta #{item.id}</span>
            </div>
          </div>

          <div className="crz-account-detail__summary">
            <div className="crz-account-detail__badges">
              <Badge tone="green">PRONTA PARA COMPRA</Badge>
              <Badge tone={item.rank ? "blue" : "neutral"}>{item.rank ?? gameName(item.game)}</Badge>
            </div>
            <small>{gameName(item.game).toUpperCase()} • CONTA #{item.id}</small>
            <h1>{item.title}</h1>
            <p>Confira rank, nível, inventário e itens desta conta antes de adicionar ao carrinho.</p>

            <div className="crz-account-detail__quick">
              {details.slice(0, 4).map(([label, value]) => <Info key={label} label={label} value={value} />)}
            </div>

            <div className="crz-account-detail__price-box">
              <div>
                <small>VALOR</small>
                <strong>{item.price != null ? formatBrl(item.price) : "Valor indisponível"}</strong>
                <span>O valor e a disponibilidade são conferidos novamente antes do pagamento.</span>
              </div>
              <NeonIcon name="shield" size={34} />
            </div>

            <div className="crz-account-detail__actions">
              <Button
                size="lg"
                disabled={item.price == null}
                onClick={addAccountToCart}
                leadingIcon={<NeonIcon name="lightning" size={20} />}
              >
                Adicionar ao carrinho
              </Button>
              <a href="/contas">← Voltar às contas</a>
            </div>
          </div>
        </section>

        <section className="crz-account-detail__content">
          <Panel className="crz-account-detail__panel">
            <SectionTitle
              icon={<NeonIcon name="verified" size={28} />}
              title="Detalhes da conta"
              description="As principais informações reunidas em um só lugar."
            />
            <div className="crz-account-detail__info-grid">
              {details.map(([label, value]) => <Info key={label} label={label} value={value} />)}
            </div>

            <div className="crz-account-detail__delivery">
              <NeonIcon name="shield" size={28} />
              <div>
                <strong>Compra protegida</strong>
                <span>A entrega acontece somente após a confirmação do pagamento e a conta fica vinculada ao seu pedido.</span>
              </div>
            </div>
          </Panel>

          <Panel className="crz-account-detail__panel crz-account-detail__inventory">
            <SectionTitle
              icon={<NeonIcon name="diamond" size={28} />}
              title="Skins e inventário"
              description={item.cosmetics.length ? item.cosmetics.length + " destaques encontrados" : "Resumo do inventário desta conta"}
            />

            {item.cosmetics.length ? (
              <div className="crz-account-detail__cosmetics">
                {item.cosmetics.map((cosmetic, index) => (
                  <article className="crz-account-detail__cosmetic" key={cosmetic.name + index}>
                    <div className="crz-account-detail__cosmetic-art">
                      {cosmetic.imagePath ? (
                        <img src={cosmetic.imagePath} alt={cosmetic.name} loading="lazy" />
                      ) : (
                        <NeonIcon name="diamond" size={28} />
                      )}
                    </div>
                    <div>
                      <strong>{cosmetic.name}</strong>
                      <span>{cosmetic.category || "Item do inventário"}</span>
                      {cosmetic.rarity && <small>{cosmetic.rarity}</small>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="crz-account-detail__inventory-empty">
                <NeonIcon name="cube" size={34} />
                <strong>{item.skinsCount ?? 0} skins • {item.knivesCount ?? 0} facas</strong>
                <span>Os itens disponíveis serão exibidos aqui quando houver prévia individual.</span>
              </div>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

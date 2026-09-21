"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, LoadingState, NeonIcon } from "@/core/design-system";
import { formatBrl } from "@/modules/cart/pricing";
import { useCart } from "@/modules/cart/CartProvider";
import { valorantRankImage } from "./legacy-data";
import type { AccountsMarketGame, AccountsMarketItem } from "./types";

type InventoryItem = {
  name: string;
  image: string;
  rarity?: string | null;
};

type InventoryTab = "skins" | "agents" | "buddies";

const regionLabels: Record<string, string> = {
  br: "Brasil",
  eu: "Europa",
  na: "América do Norte",
  ap: "Ásia-Pacífico",
  kr: "Coreia",
  latam: "LATAM",
  euw: "Europa Oeste",
  eune: "Europa Norte/Leste",
  las: "LAS",
  lan: "LAN",
  oce: "Oceania",
  tr: "Turquia",
  ru: "Rússia",
  jp: "Japão",
};

function regionName(value: string | null) {
  if (!value) return "Não informado";
  return regionLabels[value.toLowerCase()] ?? value;
}

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

function gameName(game: AccountsMarketItem["game"]) {
  if (game === "lol") return "League of Legends";
  if (game === "fortnite") return "Fortnite";
  if (game === "minecraft") return "Minecraft";
  return "VALORANT";
}

function detailsFor(item: AccountsMarketItem) {
  if (item.game === "lol") {
    return [
      ["Rank", item.rank],
      ["Região", regionName(item.region)],
      ["Nível", item.level],
      ["Skins", item.skinsCount],
      ["Campeões", item.championsCount],
      ["País", item.country],
    ] as const;
  }

  if (item.game === "fortnite") {
    return [
      ["Nível", item.level],
      ["Skins", item.skinsCount],
      ["V-Bucks", item.vbucks],
      ["Região", regionName(item.region)],
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
    ["Região", regionName(item.region)],
    ["Nível", item.level],
    ["Skins", item.skinsCount],
    ["Knifes", item.knivesCount],
    ["Agentes", item.agentsCount],
    ["Valor do inventário", item.inventoryValue],
    ["Valorant Points", item.vp],
    ["Radiant Points", item.rp],
    ["Tipo de e-mail", item.emailType],
    ["País", item.country],
  ] as const;
}

async function loadValorantInventory(item: AccountsMarketItem) {
  const [skinsResponse, agentsResponse, buddiesResponse] = await Promise.all([
    item.skinIds.length
      ? fetch("https://valorant-api.com/v1/weapons/skins?language=pt-BR", { cache: "force-cache" })
      : Promise.resolve(null),
    item.agentIds.length
      ? fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=pt-BR", { cache: "force-cache" })
      : Promise.resolve(null),
    item.buddyIds.length
      ? fetch("https://valorant-api.com/v1/buddies?language=pt-BR", { cache: "force-cache" })
      : Promise.resolve(null),
  ]);

  const skinSet = new Set(item.skinIds.map((id) => id.toLowerCase()));
  const agentSet = new Set(item.agentIds.map((id) => id.toLowerCase()));
  const buddySet = new Set(item.buddyIds.map((id) => id.toLowerCase()));

  const skinPayload = skinsResponse?.ok ? await skinsResponse.json() : null;
  const agentPayload = agentsResponse?.ok ? await agentsResponse.json() : null;
  const buddyPayload = buddiesResponse?.ok ? await buddiesResponse.json() : null;

  const skins: InventoryItem[] = (skinPayload?.data ?? [])
    .filter((skin: any) => skinSet.has(String(skin?.uuid || "").toLowerCase()))
    .map((skin: any) => ({
      name: String(skin?.displayName || "Skin"),
      image:
        skin?.levels?.[0]?.displayIcon ||
        skin?.displayIcon ||
        skin?.chromas?.[0]?.fullRender ||
        "",
      rarity: skin?.contentTierUuid ? String(skin.contentTierUuid) : null,
    }))
    .filter((skin: InventoryItem) => Boolean(skin.image));

  const agents: InventoryItem[] = (agentPayload?.data ?? [])
    .filter((agent: any) => agentSet.has(String(agent?.uuid || "").toLowerCase()))
    .map((agent: any) => ({
      name: String(agent?.displayName || "Agente"),
      image: String(agent?.displayIcon || ""),
    }))
    .filter((agent: InventoryItem) => Boolean(agent.image));

  const buddies: InventoryItem[] = [];
  for (const buddy of buddyPayload?.data ?? []) {
    const directMatch = buddySet.has(String(buddy?.uuid || "").toLowerCase());
    const matchedLevel = (buddy?.levels ?? []).find((level: any) =>
      buddySet.has(String(level?.uuid || "").toLowerCase())
    );

    if (directMatch || matchedLevel) {
      const image = matchedLevel?.displayIcon || buddy?.displayIcon || "";
      if (image) {
        buddies.push({
          name: String(buddy?.displayName || "Buddy"),
          image: String(image),
        });
      }
    }
  }

  return { skins, agents, buddies };
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
  const [inventory, setInventory] = useState<{
    skins: InventoryItem[];
    agents: InventoryItem[];
    buddies: InventoryItem[];
  }>({ skins: [], agents: [], buddies: [] });
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<InventoryTab>("skins");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  useEffect(() => {
    if (!item || item.game !== "valorant") {
      setInventory({ skins: [], agents: [], buddies: [] });
      return;
    }

    let cancelled = false;
    setInventoryLoading(true);

    loadValorantInventory(item)
      .then((next) => {
        if (!cancelled) {
          setInventory(next);
          setSelectedIndex(0);
          setActiveTab(next.skins.length ? "skins" : next.agents.length ? "agents" : "buddies");
        }
      })
      .catch(() => {
        if (!cancelled) setInventory({ skins: [], agents: [], buddies: [] });
      })
      .finally(() => {
        if (!cancelled) setInventoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item]);

  const details = useMemo(() => item ? detailsFor(item) : [], [item]);
  const activeItems = inventory[activeTab];
  const featuredItems = inventory.skins.length ? inventory.skins : activeItems;
  const selectedItem = featuredItems[selectedIndex] ?? null;

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
      name: item.rank
        ? "Conta " + item.rank + " com " + (item.skinsCount ?? 0) + " skins"
        : item.title,
      subtitle: gameName(item.game) + " • Conta #" + item.id,
      image: item.game === "valorant" ? valorantRankImage(item.rankValue) : item.imageUrl,
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

  const previousFeatured = () => {
    if (!featuredItems.length) return;
    setSelectedIndex((current) => (current - 1 + featuredItems.length) % featuredItems.length);
  };

  const nextFeatured = () => {
    if (!featuredItems.length) return;
    setSelectedIndex((current) => (current + 1) % featuredItems.length);
  };

  const rankImage = valorantRankImage(item.rankValue);

  return (
    <main className="crz-account-detail crz-account-detail--legacy">
      <div className="crz-container">
        <nav className="crz-account-detail__breadcrumb" aria-label="Breadcrumb">
          <a href="/">Início</a><span>›</span><a href="/contas">Contas</a><span>›</span><span aria-current="page">#{item.id}</span>
        </nav>

        <div className="crz-account-detail__legacy-grid">
          <section className="crz-account-detail__legacy-left">
            <div className="crz-account-detail__gallery">
              {selectedItem ? (
                <>
                  <button
                    type="button"
                    className="crz-account-detail__gallery-main"
                    onClick={() => setLightboxIndex(selectedIndex)}
                    aria-label={"Ampliar " + selectedItem.name}
                  >
                    <img src={selectedItem.image} alt={selectedItem.name} />
                    <span>{selectedItem.name}</span>
                  </button>

                  {featuredItems.length > 1 && (
                    <>
                      <button type="button" className="crz-account-detail__gallery-prev" onClick={previousFeatured}>‹</button>
                      <button type="button" className="crz-account-detail__gallery-next" onClick={nextFeatured}>›</button>
                      <div className="crz-account-detail__gallery-count">{selectedIndex + 1} / {featuredItems.length}</div>
                    </>
                  )}
                </>
              ) : (
                <div className="crz-account-detail__gallery-rank">
                  {item.game === "valorant" ? (
                    <img src={rankImage} alt={item.rank ?? "Sem rank"} />
                  ) : item.imageUrl ? (
                    <img src={item.imageUrl} alt="" />
                  ) : (
                    <NeonIcon name="gamepad" size={76} />
                  )}
                  <strong>{item.rank ?? gameName(item.game)}</strong>
                </div>
              )}
            </div>

            <div className="crz-account-detail__legacy-stats">
              {item.game === "valorant" && (
                <div className="crz-account-detail__rank-current">
                  <div>
                    <small>RANK ATUAL</small>
                    <strong>{item.rank ?? "Sem rank"}</strong>
                  </div>
                  <img src={rankImage} alt="" />
                </div>
              )}

              <h3>Informações da conta</h3>
              <div className="crz-account-detail__info-grid">
                {details.map(([label, value]) => <Info key={label} label={label} value={value} />)}
              </div>
            </div>
          </section>

          <aside className="crz-account-detail__legacy-right">
            <div className="crz-account-detail__purchase">
              <h1>
                {item.rank
                  ? "Conta " + item.rank + " com " + (item.skinsCount ?? 0) + " Skins"
                  : item.title}
              </h1>

              <div className="crz-account-detail__badges">
                <Badge tone="blue">FULL ACESSO</Badge>
                <Badge tone="green">DISPONÍVEL</Badge>
              </div>

              <div className="crz-account-detail__checklist">
                <span>✓ Entrega após confirmação do pagamento</span>
                <span>✓ Conta vinculada ao seu pedido</span>
                <span>✓ Informações verificadas antes da cobrança</span>
              </div>

              <div className="crz-account-detail__price-box">
                <div>
                  <small>POR</small>
                  <strong>{item.price != null ? formatBrl(item.price) : "Valor indisponível"}</strong>
                </div>
                <NeonIcon name="shield" size={32} />
              </div>

              <Button
                size="lg"
                disabled={item.price == null}
                onClick={addAccountToCart}
                leadingIcon={<NeonIcon name="lightning" size={20} />}
              >
                Adicionar ao carrinho
              </Button>

              <div className="crz-account-detail__highlight-grid">
                <Info label="Skins" value={item.skinsCount} />
                <Info label="Agentes" value={item.agentsCount} />
                <Info label="Nível" value={item.level} />
                <Info label="Knifes" value={item.knivesCount} />
              </div>
            </div>

            <div className="crz-account-detail__full-access">
              <NeonIcon name="verified" size={31} />
              <div>
                <h3>Conta FULL ACESSO</h3>
                <p>Acesso entregue conforme as informações da conta comprada.</p>
                <ul>
                  <li>Email e senha inclusos quando aplicável</li>
                  <li>Dados organizados na sua área de cliente</li>
                  <li>Suporte CRAZZY PROJECT</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>

        {item.game === "valorant" && (
          <section className="crz-account-detail__inventory-legacy">
            <header>
              <div>
                <span>INVENTÁRIO DA CONTA</span>
                <h2>Skins, agentes e buddies</h2>
              </div>
              {inventoryLoading && <small>Carregando inventário...</small>}
            </header>

            <div className="crz-account-detail__tabs">
              {([
                ["skins", "Skins", inventory.skins.length],
                ["agents", "Agentes", inventory.agents.length],
                ["buddies", "Buddies", inventory.buddies.length],
              ] as const).map(([key, label, count]) => (
                <button
                  type="button"
                  key={key}
                  className={activeTab === key ? "is-active" : ""}
                  onClick={() => {
                    setActiveTab(key);
                    setLightboxIndex(null);
                  }}
                >
                  {label}<span>{count}</span>
                </button>
              ))}
            </div>

            {activeItems.length ? (
              <div className="crz-account-detail__inventory-grid">
                {activeItems.map((inventoryItem, index) => (
                  <button
                    type="button"
                    key={inventoryItem.name + index}
                    onClick={() => setLightboxIndex(index)}
                    title={"Ampliar " + inventoryItem.name}
                  >
                    <div><img src={inventoryItem.image} alt={inventoryItem.name} loading="lazy" /></div>
                    <span>{inventoryItem.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="crz-account-detail__inventory-empty">
                <NeonIcon name="cube" size={34} />
                <strong>{inventoryLoading ? "Carregando itens..." : "Nenhum item individual disponível nesta categoria"}</strong>
              </div>
            )}
          </section>
        )}

        {lightboxIndex !== null && activeItems[lightboxIndex] && (
          <div
            className="crz-account-lightbox"
            role="dialog"
            aria-modal="true"
            onClick={() => setLightboxIndex(null)}
          >
            <div onClick={(event) => event.stopPropagation()}>
              <button type="button" className="crz-account-lightbox__close" onClick={() => setLightboxIndex(null)}>×</button>
              <img src={activeItems[lightboxIndex].image} alt={activeItems[lightboxIndex].name} />
              <strong>{activeItems[lightboxIndex].name}</strong>
              <div className="crz-account-lightbox__nav">
                <button
                  type="button"
                  onClick={() => setLightboxIndex((current) =>
                    current == null ? 0 : (current - 1 + activeItems.length) % activeItems.length
                  )}
                >‹</button>
                <span>{lightboxIndex + 1} / {activeItems.length}</span>
                <button
                  type="button"
                  onClick={() => setLightboxIndex((current) =>
                    current == null ? 0 : (current + 1) % activeItems.length
                  )}
                >›</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

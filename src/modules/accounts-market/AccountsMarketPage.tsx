"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  NeonIcon,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
} from "@/core/design-system";
import { formatBrl } from "@/modules/cart/pricing";
import type {
  AccountsMarketFilters,
  AccountsMarketGame,
  AccountsMarketItem,
  AccountsMarketPageData,
} from "./types";

const rankOptions = [
  [3, "Iron 1"], [4, "Iron 2"], [5, "Iron 3"],
  [6, "Bronze 1"], [7, "Bronze 2"], [8, "Bronze 3"],
  [9, "Silver 1"], [10, "Silver 2"], [11, "Silver 3"],
  [12, "Gold 1"], [13, "Gold 2"], [14, "Gold 3"],
  [15, "Platinum 1"], [16, "Platinum 2"], [17, "Platinum 3"],
  [18, "Diamond 1"], [19, "Diamond 2"], [20, "Diamond 3"],
  [21, "Ascendant 1"], [22, "Ascendant 2"], [23, "Ascendant 3"],
  [24, "Immortal 1"], [25, "Immortal 2"], [26, "Immortal 3"],
  [27, "Radiant"],
] as const;

const gameTabs: Array<{ id: AccountsMarketGame; label: string }> = [
  { id: "valorant", label: "VALORANT" },
  { id: "lol", label: "League of Legends" },
  { id: "fortnite", label: "Fortnite" },
  { id: "minecraft", label: "Minecraft" },
];

const emptyFilters: AccountsMarketFilters = {
  query: "",
  page: 1,
  orderBy: "pdate_to_down",
  rankMin: "",
  rankMax: "",
  levelMin: "",
  levelMax: "",
  skinsMin: "",
  knivesMin: "",
  region: "",
  championsMin: "",
  vbucksMin: "",
  platform: "",
  capesMin: "",
  minecoinsMin: "",
  hypixelLevelMin: "",
  javaEdition: "",
  bedrockEdition: "",
};

function gameLabel(game: AccountsMarketGame) {
  return gameTabs.find((item) => item.id === game)?.label ?? game;
}

function buildSearchParams(game: AccountsMarketGame, filters: AccountsMarketFilters) {
  const params = new URLSearchParams();
  params.set("game", game);
  params.set("page", String(filters.page));
  params.set("orderBy", filters.orderBy);

  for (const key of Object.keys(filters) as Array<keyof AccountsMarketFilters>) {
    if (key === "page" || key === "orderBy") continue;
    const value = filters[key];
    if (typeof value === "string" && value.trim()) params.set(key, value.trim());
  }

  return params;
}

function displayBoolean(value: boolean | null) {
  if (value == null) return "—";
  return value ? "Sim" : "Não";
}

function cardStats(item: AccountsMarketItem) {
  if (item.game === "lol") {
    return [
      ["Região", item.region],
      ["Nível", item.level],
      ["Skins", item.skinsCount],
      ["Campeões", item.championsCount],
    ] as const;
  }
  if (item.game === "fortnite") {
    return [
      ["Região", item.region],
      ["Nível", item.level],
      ["Skins", item.skinsCount],
      ["V-Bucks", item.vbucks],
    ] as const;
  }
  if (item.game === "minecraft") {
    return [
      ["Hypixel", item.level],
      ["Capas", item.capesCount],
      ["Minecoins", item.minecoins],
      ["Java", displayBoolean(item.java)],
    ] as const;
  }
  return [
    ["Região", item.region],
    ["Nível", item.level],
    ["Skins", item.skinsCount],
    ["Facas", item.knivesCount],
  ] as const;
}

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="crz-account-stat">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

function AccountCard({ item }: { item: AccountsMarketItem }) {
  const stats = cardStats(item);
  const preview = item.cosmetics.slice(0, 4);
  const game = item.game === "unknown" ? "valorant" : item.game;

  return (
    <article className="crz-account-card">
      <a className="crz-account-card__visual" href={"/contas/" + encodeURIComponent(item.id) + "?game=" + game}>
        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <NeonIcon name="gamepad" size={74} />}
        <div className="crz-account-card__shade" />
        <div className="crz-account-card__status"><i /> DISPONÍVEL</div>
        <Badge tone={item.rank ? "blue" : "neutral"}>
          {item.rank ?? gameLabel(game)}
        </Badge>
      </a>

      <div className="crz-account-card__body">
        <div className="crz-account-card__title">
          <small>{gameLabel(game)} • CONTA #{item.id}</small>
          <h3>{item.title}</h3>
        </div>

        <div className="crz-account-card__stats">
          {stats.map(([label, value]) => <Stat key={label} label={label} value={value} />)}
        </div>

        <div className="crz-account-card__preview-row" aria-label="Destaques da conta">
          {(preview.length ? preview : [
            { name: "Skins", category: item.skinsCount ? String(item.skinsCount) : "Inventário", rarity: null, imagePath: null },
            { name: "Rank", category: item.rank ?? "Sem rank", rarity: null, imagePath: null },
            { name: "Nível", category: item.level != null ? String(item.level) : "—", rarity: null, imagePath: null },
            { name: "Região", category: item.region ?? "Global", rarity: null, imagePath: null },
          ]).map((cosmetic, index) => (
            <div className="crz-account-card__preview" key={cosmetic.name + index}>
              <span>{cosmetic.name.slice(0, 2).toUpperCase()}</span>
              <small>{cosmetic.category || cosmetic.rarity || "Item"}</small>
            </div>
          ))}
        </div>

        <div className="crz-account-card__footer">
          <div>
            <small>VALOR</small>
            <strong>{item.price != null ? formatBrl(item.price) : "Consultar"}</strong>
            <span>Entrega após confirmação do pagamento</span>
          </div>
          <a href={"/contas/" + encodeURIComponent(item.id) + "?game=" + game}>
            Ver conta <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </article>
  );
}

export function AccountsMarketPage() {
  const [game, setGame] = useState<AccountsMarketGame>("valorant");
  const [draft, setDraft] = useState<AccountsMarketFilters>({ ...emptyFilters });
  const [applied, setApplied] = useState<AccountsMarketFilters>({ ...emptyFilters });
  const [data, setData] = useState<AccountsMarketPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const label = useMemo(() => gameLabel(game), [game]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch("/api/accounts?" + buildSearchParams(game, applied).toString(), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar as contas.");
        return payload as AccountsMarketPageData;
      })
      .then(setData)
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") {
          setData(null);
          setError(requestError.message || "Não foi possível carregar as contas.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [applied, game]);

  const setField = <K extends keyof AccountsMarketFilters>(
    field: K,
    value: AccountsMarketFilters[K]
  ) => setDraft((current) => ({ ...current, [field]: value }));

  const clearFilters = () => {
    const reset = { ...emptyFilters };
    setDraft(reset);
    setApplied(reset);
  };

  const selectGame = (next: AccountsMarketGame) => {
    setGame(next);
    const reset = { ...emptyFilters };
    setDraft(reset);
    setApplied(reset);
    setData(null);
  };

  const isLive = Boolean(data && !error && !loading);

  return (
    <main className="crz-accounts-market">
      <section className="crz-accounts-hero">
        <div className="crz-container">
          <PageHeader
            eyebrow="CRAZZY ACCOUNTS"
            title="Marketplace de contas"
            description="Escolha o jogo, filtre o inventário e confira todos os detalhes antes de comprar."
            actions={
              <div className={"crz-accounts-source " + (isLive ? "is-live" : "is-pending")}>
                <span><i aria-hidden="true" /> {isLive ? "CATÁLOGO ONLINE" : "ATUALIZANDO"}</span>
                <strong>CRAZZY MARKET</strong>
              </div>
            }
          />

          <div className="crz-accounts-games" role="tablist" aria-label="Jogos">
            {gameTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                role="tab"
                aria-selected={game === tab.id}
                className={game === tab.id ? "is-active" : ""}
                onClick={() => selectGame(tab.id)}
              >
                <NeonIcon name={tab.id === "valorant" ? "gamepad" : "cube"} size={25} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="crz-container crz-accounts-layout">
        <aside className="crz-accounts-filters">
          <header>
            <span>REFINAR BUSCA</span>
            <h2>Filtros {label}</h2>
            <p>Encontre contas pelo rank, nível, skins, região e outros detalhes.</p>
          </header>

          <div className="crz-accounts-field">
            <span>Buscar no título</span>
            <SearchInput
              value={draft.query}
              onChange={(event) => setField("query", event.target.value)}
              placeholder="Buscar conta..."
              aria-label="Buscar conta pelo título"
            />
          </div>

          {game === "valorant" && (
            <div className="crz-accounts-filter-grid">
              <div className="crz-accounts-field">
                <span>Rank mínimo</span>
                <Select value={draft.rankMin} onChange={(e) => setField("rankMin", e.target.value)}>
                  <option value="">Qualquer</option>
                  {rankOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </Select>
              </div>
              <div className="crz-accounts-field">
                <span>Rank máximo</span>
                <Select value={draft.rankMax} onChange={(e) => setField("rankMax", e.target.value)}>
                  <option value="">Qualquer</option>
                  {rankOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </Select>
              </div>
            </div>
          )}

          {game !== "minecraft" && (
            <div className="crz-accounts-filter-grid">
              <label className="crz-accounts-field">
                <span>Nível mínimo</span>
                <input type="number" min="0" value={draft.levelMin} onChange={(e) => setField("levelMin", e.target.value)} />
              </label>
              <label className="crz-accounts-field">
                <span>Nível máximo</span>
                <input type="number" min="0" value={draft.levelMax} onChange={(e) => setField("levelMax", e.target.value)} />
              </label>
            </div>
          )}

          {game !== "minecraft" && (
            <label className="crz-accounts-field">
              <span>Mínimo de skins</span>
              <input type="number" min="0" value={draft.skinsMin} onChange={(e) => setField("skinsMin", e.target.value)} />
            </label>
          )}

          {game === "valorant" && (
            <label className="crz-accounts-field">
              <span>Mínimo de facas</span>
              <input type="number" min="0" value={draft.knivesMin} onChange={(e) => setField("knivesMin", e.target.value)} />
            </label>
          )}

          {game === "lol" && (
            <label className="crz-accounts-field">
              <span>Mínimo de campeões</span>
              <input type="number" min="0" value={draft.championsMin} onChange={(e) => setField("championsMin", e.target.value)} />
            </label>
          )}

          {(game === "valorant" || game === "lol") && (
            <label className="crz-accounts-field">
              <span>Região</span>
              <input value={draft.region} onChange={(e) => setField("region", e.target.value)} placeholder="Ex: BR, NA, EU" />
            </label>
          )}

          {game === "fortnite" && (
            <>
              <label className="crz-accounts-field">
                <span>Mínimo de V-Bucks</span>
                <input type="number" min="0" value={draft.vbucksMin} onChange={(e) => setField("vbucksMin", e.target.value)} />
              </label>
              <label className="crz-accounts-field">
                <span>Plataforma</span>
                <input value={draft.platform} onChange={(e) => setField("platform", e.target.value)} placeholder="Epic, Xbox, PSN..." />
              </label>
            </>
          )}

          {game === "minecraft" && (
            <>
              <div className="crz-accounts-filter-grid">
                <label className="crz-accounts-field">
                  <span>Mínimo de capas</span>
                  <input type="number" min="0" value={draft.capesMin} onChange={(e) => setField("capesMin", e.target.value)} />
                </label>
                <label className="crz-accounts-field">
                  <span>Mínimo Minecoins</span>
                  <input type="number" min="0" value={draft.minecoinsMin} onChange={(e) => setField("minecoinsMin", e.target.value)} />
                </label>
              </div>
              <label className="crz-accounts-field">
                <span>Nível Hypixel mínimo</span>
                <input type="number" min="0" value={draft.hypixelLevelMin} onChange={(e) => setField("hypixelLevelMin", e.target.value)} />
              </label>
              <div className="crz-accounts-filter-grid">
                <div className="crz-accounts-field">
                  <span>Java</span>
                  <Select value={draft.javaEdition} onChange={(e) => setField("javaEdition", e.target.value)}>
                    <option value="">Qualquer</option><option value="1">Sim</option><option value="0">Não</option>
                  </Select>
                </div>
                <div className="crz-accounts-field">
                  <span>Bedrock</span>
                  <Select value={draft.bedrockEdition} onChange={(e) => setField("bedrockEdition", e.target.value)}>
                    <option value="">Qualquer</option><option value="1">Sim</option><option value="0">Não</option>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="crz-accounts-field">
            <span>Ordenar</span>
            <Select
              value={draft.orderBy}
              onChange={(event) => setField("orderBy", event.target.value as AccountsMarketFilters["orderBy"])}
            >
              <option value="pdate_to_down">Mais recentes</option>
              <option value="price_to_up">Menor preço</option>
              <option value="price_to_down">Maior preço</option>
            </Select>
          </div>

          <div className="crz-accounts-filter-actions">
            <Button onClick={() => setApplied({ ...draft, page: 1 })}>Aplicar filtros</Button>
            <Button variant="secondary" onClick={clearFilters}>Limpar</Button>
          </div>

          <div className="crz-accounts-security-note">
            <NeonIcon name="shield" size={28} />
            <div>
              <strong>Compra protegida</strong>
              <span>Disponibilidade e valor são confirmados novamente antes da cobrança.</span>
            </div>
          </div>
        </aside>

        <section className="crz-accounts-results" aria-live="polite">
          <header className="crz-accounts-results__head">
            <div>
              <span>CONTAS DISPONÍVEIS</span>
              <h2>{label}</h2>
            </div>
            <div className="crz-accounts-results__count">
              <strong>{data?.totalItems ?? 0}</strong>
              <span>encontradas</span>
            </div>
          </header>

          {loading ? (
            <div className="crz-accounts-state"><LoadingState label={"Buscando contas de " + label + "..."} /></div>
          ) : error ? (
            <div className="crz-accounts-state">
              <ErrorState
                title="Não foi possível carregar as contas"
                description={error}
                onRetry={() => setApplied((current) => ({ ...current }))}
              />
            </div>
          ) : !data?.items.length ? (
            <div className="crz-accounts-state">
              <EmptyState
                icon={<NeonIcon name="gamepad" size={34} />}
                title="Nenhuma conta encontrada"
                description="Tente remover alguns filtros ou alterar a busca."
                action={<Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>}
              />
            </div>
          ) : (
            <>
              <div className="crz-accounts-grid">
                {data.items.map((item) => <AccountCard key={item.id} item={item} />)}
              </div>
              <footer className="crz-accounts-pagination">
                <div>Página <strong>{data.currentPage}</strong> de <strong>{data.totalPages}</strong></div>
                <Pagination
                  page={data.currentPage}
                  totalPages={data.totalPages}
                  onChange={(page) => {
                    setDraft((current) => ({ ...current, page }));
                    setApplied((current) => ({ ...current, page }));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </footer>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

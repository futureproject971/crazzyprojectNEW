"use client";

import { useEffect, useState } from "react";
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

const gameTabs: Array<{ id: AccountsMarketGame; label: string; ready: boolean }> = [
  { id: "valorant", label: "VALORANT", ready: true },
  { id: "lol", label: "League of Legends", ready: false },
  { id: "fortnite", label: "Fortnite", ready: false },
  { id: "minecraft", label: "Minecraft", ready: false },
];

const initialFilters: AccountsMarketFilters = {
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
};

function buildSearchParams(filters: AccountsMarketFilters) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("order_by", filters.orderBy);

  if (filters.query.trim()) params.set("title", filters.query.trim());
  if (filters.rankMin) params.set("rmin", filters.rankMin);
  if (filters.rankMax) params.set("rmax", filters.rankMax);
  if (filters.levelMin) params.set("valorant_level_min", filters.levelMin);
  if (filters.levelMax) params.set("valorant_level_max", filters.levelMax);
  if (filters.skinsMin) params.set("valorant_smin", filters.skinsMin);
  if (filters.knivesMin) params.set("valorant_knife_min", filters.knivesMin);
  if (filters.region.trim()) params.append("valorant_region[]", filters.region.trim());

  return params;
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="crz-account-stat">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

function AccountCard({ item }: { item: AccountsMarketItem }) {
  return (
    <article className="crz-account-card">
      <div className="crz-account-card__visual">
        <div className="crz-account-card__grid" aria-hidden="true" />
        <NeonIcon name="gamepad" size={72} />
        <div className="crz-account-card__live">
          <i aria-hidden="true" />
          LZT LIVE
        </div>
        <Badge tone={item.rank ? "blue" : "neutral"}>
          {item.rank ?? "RANK N/D"}
        </Badge>
      </div>

      <div className="crz-account-card__body">
        <div className="crz-account-card__title">
          <small>CONTA #{item.id}</small>
          <h3>{item.title}</h3>
        </div>

        <div className="crz-account-card__stats">
          <Stat label="Região" value={item.region} />
          <Stat label="Nível" value={item.level} />
          <Stat label="Skins" value={item.skinsCount} />
          <Stat label="Facas" value={item.knivesCount} />
        </div>

        <div className="crz-account-card__footer">
          <div>
            <small>VALOR CRAZZY</small>
            <strong>Calculado com segurança</strong>
            <span>Preço final não é confiado ao navegador.</span>
          </div>

          <a href={"/contas/" + encodeURIComponent(item.id)}>
            Ver detalhes
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </article>
  );
}

export function AccountsMarketPage() {
  const [game, setGame] = useState<AccountsMarketGame>("valorant");
  const [draft, setDraft] = useState<AccountsMarketFilters>(initialFilters);
  const [applied, setApplied] = useState<AccountsMarketFilters>(initialFilters);
  const [data, setData] = useState<AccountsMarketPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (game !== "valorant") return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch("/api/accounts?" + buildSearchParams(applied).toString(), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Falha ao carregar contas.");
        return payload as AccountsMarketPageData;
      })
      .then((payload) => setData(payload))
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "Falha ao carregar contas.");
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
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = () => {
    setApplied({ ...draft, page: 1 });
  };

  const clearFilters = () => {
    setDraft(initialFilters);
    setApplied(initialFilters);
  };

  const selectGame = (next: AccountsMarketGame) => {
    setGame(next);
    setError(null);
    if (next === "valorant") {
      setApplied((current) => ({ ...current, page: 1 }));
    }
  };

  return (
    <main className="crz-accounts-market">
      <section className="crz-accounts-hero">
        <div className="crz-container">
          <PageHeader
            eyebrow="M06 • CRAZZY ACCOUNTS MARKET"
            title="Contas de jogos"
            description="Contas vindas da integração LZT já existente, apresentadas na identidade CRAZZY PROJECT sem expor token, credencial ou compra direta no navegador."
            actions={
              <div className="crz-accounts-source">
                <span><i aria-hidden="true" /> PROVIDER ONLINE</span>
                <strong>LZT MARKET</strong>
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
                {!tab.ready && <small>MIGRAÇÃO</small>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {game !== "valorant" ? (
        <div className="crz-container crz-accounts-pending">
          <EmptyState
            icon={<NeonIcon name="gear" size={34} />}
            title={gameTabs.find((item) => item.id === game)?.label + " está sendo migrado"}
            description="A arquitetura já reserva este jogo, mas o adapter LZT acessível nesta etapa ainda está focado em Riot/VALORANT. Não vamos fabricar dados nem integração falsa."
            action={
              <Button variant="secondary" onClick={() => selectGame("valorant")}>
                Voltar para VALORANT
              </Button>
            }
          />
        </div>
      ) : (
        <div className="crz-container crz-accounts-layout">
          <aside className="crz-accounts-filters">
            <header>
              <span>REFINAR BUSCA</span>
              <h2>Filtros VALORANT</h2>
              <p>Filtros já suportados pela integração LZT existente.</p>
            </header>

            <label className="crz-accounts-field">
              <span>Buscar no título</span>
              <SearchInput
                value={draft.query}
                onChange={(event) => setField("query", event.target.value)}
                placeholder="Ex: skins, rank..."
                aria-label="Buscar conta pelo título"
              />
            </label>

            <div className="crz-accounts-filter-grid">
              <label className="crz-accounts-field">
                <span>Rank mínimo</span>
                <Select
                  value={draft.rankMin}
                  onChange={(event) => setField("rankMin", event.target.value)}
                  aria-label="Rank mínimo"
                >
                  <option value="">Qualquer</option>
                  {rankOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </label>

              <label className="crz-accounts-field">
                <span>Rank máximo</span>
                <Select
                  value={draft.rankMax}
                  onChange={(event) => setField("rankMax", event.target.value)}
                  aria-label="Rank máximo"
                >
                  <option value="">Qualquer</option>
                  {rankOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="crz-accounts-filter-grid">
              <label className="crz-accounts-field">
                <span>Nível mínimo</span>
                <input
                  type="number"
                  min="0"
                  value={draft.levelMin}
                  onChange={(event) => setField("levelMin", event.target.value)}
                  placeholder="0"
                />
              </label>

              <label className="crz-accounts-field">
                <span>Nível máximo</span>
                <input
                  type="number"
                  min="0"
                  value={draft.levelMax}
                  onChange={(event) => setField("levelMax", event.target.value)}
                  placeholder="Sem limite"
                />
              </label>
            </div>

            <div className="crz-accounts-filter-grid">
              <label className="crz-accounts-field">
                <span>Mín. de skins</span>
                <input
                  type="number"
                  min="0"
                  value={draft.skinsMin}
                  onChange={(event) => setField("skinsMin", event.target.value)}
                  placeholder="0"
                />
              </label>

              <label className="crz-accounts-field">
                <span>Mín. de facas</span>
                <input
                  type="number"
                  min="0"
                  value={draft.knivesMin}
                  onChange={(event) => setField("knivesMin", event.target.value)}
                  placeholder="0"
                />
              </label>
            </div>

            <label className="crz-accounts-field">
              <span>Região</span>
              <input
                value={draft.region}
                onChange={(event) => setField("region", event.target.value)}
                placeholder="Código de região LZT"
              />
            </label>

            <label className="crz-accounts-field">
              <span>Ordenar</span>
              <Select
                value={draft.orderBy}
                onChange={(event) =>
                  setField("orderBy", event.target.value as AccountsMarketFilters["orderBy"])
                }
                aria-label="Ordenar contas"
              >
                <option value="pdate_to_down">Mais recentes</option>
                <option value="price_to_up">Menor preço do provedor</option>
                <option value="price_to_down">Maior preço do provedor</option>
              </Select>
            </label>

            <div className="crz-accounts-filter-actions">
              <Button onClick={applyFilters}>Aplicar filtros</Button>
              <Button variant="secondary" onClick={clearFilters}>Limpar</Button>
            </div>

            <div className="crz-accounts-security-note">
              <NeonIcon name="shield" size={28} />
              <div>
                <strong>Preço protegido</strong>
                <span>O M06 não confia em preço vindo do browser e não executa compra.</span>
              </div>
            </div>
          </aside>

          <section className="crz-accounts-results" aria-live="polite">
            <header className="crz-accounts-results__head">
              <div>
                <span>MARKET LIVE</span>
                <h2>Contas VALORANT</h2>
              </div>
              <div className="crz-accounts-results__count">
                <strong>{data?.totalItems ?? 0}</strong>
                <span>encontradas</span>
              </div>
            </header>

            {loading ? (
              <div className="crz-accounts-state">
                <LoadingState label="Consultando contas no provider..." />
              </div>
            ) : error ? (
              <div className="crz-accounts-state">
                <ErrorState
                  title="Não foi possível carregar o market"
                  description={error}
                  onRetry={() => setApplied((current) => ({ ...current }))}
                />
              </div>
            ) : !data?.items.length ? (
              <div className="crz-accounts-state">
                <EmptyState
                  icon={<NeonIcon name="gamepad" size={34} />}
                  title="Nenhuma conta encontrada"
                  description="Tente remover filtros ou alterar os limites da busca."
                  action={<Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>}
                />
              </div>
            ) : (
              <>
                <div className="crz-accounts-grid">
                  {data.items.map((item) => <AccountCard key={item.id} item={item} />)}
                </div>

                <footer className="crz-accounts-pagination">
                  <div>
                    Página <strong>{data.currentPage}</strong> de <strong>{data.totalPages}</strong>
                  </div>
                  <Pagination
                    page={data.currentPage}
                    totalPages={data.totalPages}
                    onChange={(page) => {
                      setDraft((current) => ({ ...current, page }));
                      setApplied((current) => ({ ...current, page }));
                      window.scrollTo({ top: 330, behavior: "smooth" });
                    }}
                  />
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

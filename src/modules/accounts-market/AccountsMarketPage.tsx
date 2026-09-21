"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  NeonIcon,
  PageHeader,
  Pagination,
} from "@/core/design-system";
import { formatBrl } from "@/modules/cart/pricing";
import {
  gameTabs,
  lolRankApiValues,
  lolRankFilters,
  valorantRankFilters,
  valorantRankImage,
  valorantRegions,
  lolRegions,
  weapons,
} from "./legacy-data";
import type {
  AccountsMarketFilters,
  AccountsMarketGame,
  AccountsMarketItem,
  AccountsMarketPageData,
} from "./types";

type SkinPreview = { name: string; image: string };
type SkinCatalog = Record<string, SkinPreview>;

function initialFilters(game: AccountsMarketGame): AccountsMarketFilters {
  return {
    query: "",
    page: 1,
    orderBy: "pdate_to_down",
    rankMin: "",
    rankMax: "",
    levelMin: "",
    levelMax: "",
    skinsMin: "",
    knivesMin: "",
    region: game === "valorant" ? "br" : "",
    championsMin: "",
    vbucksMin: "",
    platform: "",
    capesMin: "",
    minecoinsMin: "",
    hypixelLevelMin: "",
    javaEdition: "",
    bedrockEdition: "",
    weapon: "todos",
    onlyKnife: "",
    priceMin: "",
    priceMax: "",
    inventoryMin: "",
    inventoryMax: "",
  };
}

function gameLabel(game: AccountsMarketGame) {
  return gameTabs.find((item) => item.id === game)?.label ?? game;
}


function GameTabLogo({ game }: { game: AccountsMarketGame }) {
  if (game === "valorant") {
    return (
      <svg className="crz-account-game-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z" />
      </svg>
    );
  }

  if (game === "lol") {
    return (
      <svg className="crz-account-game-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="m1.912 0 1.212 2.474v19.053L1.912 24h14.73l1.337-4.682H8.33V0ZM12 1.516c-.913 0-1.798.112-2.648.312v1.74a9.738 9.738 0 0 1 2.648-.368c5.267 0 9.536 4.184 9.536 9.348a9.203 9.203 0 0 1-2.3 6.086l-.273.954-.602 2.112c2.952-1.993 4.89-5.335 4.89-9.122C23.25 6.468 18.213 1.516 12 1.516Zm0 2.673c-.924 0-1.814.148-2.648.414v13.713h8.817a8.246 8.246 0 0 0 2.36-5.768c0-4.617-3.818-8.359-8.529-8.359zM2.104 7.312A10.858 10.858 0 0 0 .75 12.576c0 1.906.492 3.7 1.355 5.266z" />
      </svg>
    );
  }

  if (game === "fortnite") {
    return (
      <svg className="crz-account-game-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="m15.767 14.171.097-5.05H12.4V5.197h3.99L16.872 0H7.128v24l5.271-.985V14.17z" />
      </svg>
    );
  }

  return (
    <svg className="crz-account-game-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V4A2,2 0 0,1 4,2M6,6V10H10V12H8V18H10V16H14V18H16V12H14V10H18V6H14V10H10V6H6Z" />
    </svg>
  );
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

function activityRisk(days: number | null) {
  if (days == null) return { label: "Sem dado", level: "unknown" as const };
  if (days >= 90) return { label: "Baixo", level: "low" as const };
  if (days >= 30) return { label: "Médio", level: "medium" as const };
  return { label: "Alto", level: "high" as const };
}

function offlineLabel(days: number | null) {
  if (days == null) return "Inatividade não informada";
  if (days === 0) return "Ativa recentemente";
  if (days === 1) return "Inativa há 1 dia";
  return "Inativa há " + days + " dias";
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
      ["Nível", item.level],
      ["Skins", item.skinsCount],
      ["V-Bucks", item.vbucks],
      ["Região", item.region],
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
    ["Nível", item.level],
    ["Skins", item.skinsCount],
    ["Facas", item.knivesCount],
    ["Região", item.region],
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

function FilterSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="crz-account-filter-section">
      <button type="button" className="crz-account-filter-section__head" onClick={onToggle}>
        <span>{icon}{title}</span>
        <b className={open ? "is-open" : ""}>⌄</b>
      </button>
      {open && <div className="crz-account-filter-section__body">{children}</div>}
    </section>
  );
}

function RangePair({
  min,
  max,
  onMin,
  onMax,
  prefix,
}: {
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
  prefix?: string;
}) {
  return (
    <div className="crz-account-range">
      <label>
        {prefix && <span>{prefix}</span>}
        <input type="number" min="0" placeholder="Min" value={min} onChange={(e) => onMin(e.target.value)} />
      </label>
      <i>—</i>
      <label>
        {prefix && <span>{prefix}</span>}
        <input type="number" min="0" placeholder="Máx" value={max} onChange={(e) => onMax(e.target.value)} />
      </label>
    </div>
  );
}

function AccountCard({
  item,
  skinCatalog,
}: {
  item: AccountsMarketItem;
  skinCatalog: SkinCatalog;
}) {
  const game = item.game === "unknown" ? "valorant" : item.game;
  const stats = cardStats(item);
  const previews = item.skinIds
    .map((id) => skinCatalog[id.toLowerCase()])
    .filter(Boolean)
    .slice(0, 6);
  const rankImage = valorantRankImage(item.rankValue);
  const hasKnife = (item.knivesCount ?? 0) > 0;
  const risk = activityRisk(item.offlineDays);

  return (
    <article className="crz-account-card crz-account-card--legacy">
      <a
        className="crz-account-card__visual crz-account-card__visual--legacy"
        href={"/contas/" + encodeURIComponent(item.id) + "?game=" + game}
      >
        <div className="crz-account-card__shade" />

        <div className="crz-account-card__chips">
          {hasKnife && <span>KNIFE</span>}
          <span>FULL ACESSO</span>
        </div>

        {game === "valorant" && previews.length > 0 ? (
          <div className="crz-account-card__skin-grid">
            {previews.map((skin, index) => (
              <div key={skin.name + index} title={skin.name}>
                <img src={skin.image} alt={skin.name} loading="lazy" />
              </div>
            ))}
          </div>
        ) : (
          <div className="crz-account-card__fallback-art">
            {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <NeonIcon name="gamepad" size={66} />}
          </div>
        )}
      </a>

      <div className="crz-account-card__body">
        <div className="crz-account-card__legacy-rank">
          {game === "valorant" && <img src={rankImage} alt="" />}
          <div>
            <small>{gameLabel(game)} • CONTA #{item.id}</small>
            <strong>{item.rank ?? (game === "valorant" ? "Sem rank" : item.title)}</strong>
          </div>
          <span>{item.skinsCount ?? 0} skins</span>
        </div>

        <div className="crz-account-card__activity">
          <div>
            <small>ÚLTIMA ATIVIDADE</small>
            <strong>{offlineLabel(item.offlineDays)}</strong>
          </div>
          <span
            className={"crz-account-risk crz-account-risk--" + risk.level}
            title="Estimativa baseada somente no tempo de inatividade informado pelo catálogo."
          >
            Risco estimado: {risk.label}
          </span>
        </div>

        <div className="crz-account-card__legacy-benefits">
          <span>✓ Conta Full Acesso</span>
          <span>✓ Email e senha inclusos</span>
          <span>✓ Entrega após confirmação</span>
        </div>

        <div className="crz-account-card__stats">
          {stats.map(([label, value]) => <Stat key={label} label={label} value={value} />)}
        </div>

        <div className="crz-account-card__footer">
          <div>
            <small>VALOR</small>
            <strong>{item.price != null ? formatBrl(item.price) : "Consultar"}</strong>
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
  const [draft, setDraft] = useState<AccountsMarketFilters>(() => initialFilters("valorant"));
  const [applied, setApplied] = useState<AccountsMarketFilters>(() => initialFilters("valorant"));
  const [data, setData] = useState<AccountsMarketPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skinCatalog, setSkinCatalog] = useState<SkinCatalog>({});

  const [rankOpen, setRankOpen] = useState(true);
  const [skinsOpen, setSkinsOpen] = useState(true);
  const [regionOpen, setRegionOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [levelOpen, setLevelOpen] = useState(true);

  const label = useMemo(() => gameLabel(game), [game]);

  useEffect(() => {
    const timer = window.setTimeout(() => setApplied({ ...draft }), 480);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (game !== "valorant" || Object.keys(skinCatalog).length) return;
    const controller = new AbortController();

    fetch("https://valorant-api.com/v1/weapons/skins?language=pt-BR", {
      signal: controller.signal,
      cache: "force-cache",
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const next: SkinCatalog = {};
        for (const skin of payload?.data ?? []) {
          const id = String(skin?.uuid || "").toLowerCase();
          const image =
            skin?.levels?.[0]?.displayIcon ||
            skin?.displayIcon ||
            skin?.chromas?.[0]?.fullRender;
          if (id && image) next[id] = { name: String(skin.displayName || "Skin"), image };
        }
        if (!controller.signal.aborted) setSkinCatalog(next);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [game, skinCatalog]);

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
  ) => setDraft((current) => ({ ...current, [field]: value, page: 1 }));

  const clearFilters = () => {
    const reset = initialFilters(game);
    setDraft(reset);
    setApplied(reset);
  };

  const selectGame = (next: AccountsMarketGame) => {
    const reset = initialFilters(next);
    setGame(next);
    setDraft(reset);
    setApplied(reset);
    setData(null);
  };

  const selectedRank = valorantRankFilters.find(
    (rank) => rank.rmin === draft.rankMin && rank.rmax === draft.rankMax
  )?.id ?? "todos";

  const isLive = Boolean(data && !error && !loading);
  const activeTheme = gameTabs.find((tab) => tab.id === game) ?? gameTabs[0];

  return (
    <main
      className={"crz-accounts-market crz-accounts-market--" + game}
      style={{
        "--account-accent": activeTheme.accent,
        "--account-accent-soft": activeTheme.accentSoft,
      } as React.CSSProperties}
    >
      <section className="crz-accounts-hero">
        <div className="crz-container">
          <PageHeader
            eyebrow="CRAZZY ACCOUNTS"
            title="Marketplace de contas"
            description="Escolha o jogo, filtre a conta e confira inventário, rank e detalhes antes da compra."
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
                style={game === tab.id ? {
                  borderColor: tab.accent,
                  background: "radial-gradient(circle at 50% 0%, " + tab.accentSoft + ", transparent 62%), linear-gradient(180deg, rgba(10,22,39,.96), rgba(4,12,24,.98))",
                  boxShadow: "0 0 22px " + tab.accentSoft,
                  color: "#fff",
                } : undefined}
                onClick={() => selectGame(tab.id)}
              >
                <GameTabLogo game={tab.id} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="crz-container crz-accounts-layout crz-accounts-layout--legacy">
        <aside className="crz-accounts-filters crz-accounts-filters--legacy">
          <header className="crz-account-filter-title">
            <div>
              <NeonIcon name="gear" size={19} />
              <h2>Filtros</h2>
            </div>
            <button type="button" onClick={clearFilters}>Limpar</button>
          </header>

          <label className="crz-account-filter-search">
            <span>⌕</span>
            <input
              value={draft.query}
              onChange={(event) => setField("query", event.target.value.slice(0, 100))}
              placeholder="Buscar contas..."
            />
          </label>

          {game === "valorant" && (
            <>
              <FilterSection
                title="Elo / Rank"
                open={rankOpen}
                onToggle={() => setRankOpen((value) => !value)}
              >
                <div className="crz-account-rank-grid">
                  {valorantRankFilters.map((rank) => (
                    <button
                      type="button"
                      key={rank.id}
                      className={selectedRank === rank.id ? "is-active" : ""}
                      onClick={() => {
                        setField("rankMin", rank.rmin);
                        setDraft((current) => ({ ...current, rankMin: rank.rmin, rankMax: rank.rmax, page: 1 }));
                      }}
                    >
                      <img src={rank.img} alt="" />
                      <span>{rank.name}</span>
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection
                title="Skins de Arma"
                icon={<NeonIcon name="customization" size={15} />}
                open={skinsOpen}
                onToggle={() => setSkinsOpen((value) => !value)}
              >
                <div className="crz-account-weapon-grid">
                  {weapons.map((weapon) => (
                    <button
                      type="button"
                      key={weapon.id}
                      className={draft.weapon === weapon.id ? "is-active" : ""}
                      onClick={() => setField("weapon", weapon.id)}
                      title={weapon.name}
                    >
                      {weapon.img ? <img src={weapon.img} alt="" /> : <strong>▦</strong>}
                      <span>{weapon.name}</span>
                    </button>
                  ))}
                </div>
              </FilterSection>

              <label className="crz-account-switch">
                <input
                  type="checkbox"
                  checked={draft.onlyKnife === "true"}
                  onChange={(event) => setField("onlyKnife", event.target.checked ? "true" : "")}
                />
                <i />
                <span>Apenas com Knife</span>
              </label>

              <FilterSection
                title="Região"
                icon={<NeonIcon name="community" size={15} />}
                open={regionOpen}
                onToggle={() => setRegionOpen((value) => !value)}
              >
                <select value={draft.region} onChange={(e) => setField("region", e.target.value)}>
                  {valorantRegions.map((region) => (
                    <option key={region.id} value={region.id}>{region.label}</option>
                  ))}
                </select>
              </FilterSection>
            </>
          )}

          {game === "lol" && (
            <>
              <FilterSection title="Elo / Rank" open={rankOpen} onToggle={() => setRankOpen((v) => !v)}>
                <div className="crz-account-rank-grid crz-account-rank-grid--lol">
                  {lolRankFilters.map((rank) => (
                    <button
                      type="button"
                      key={rank.id}
                      className={draft.rankMin === rank.id ? "is-active" : ""}
                      onClick={() => {
                        setField("rankMin", rank.id === "todos" ? "" : rank.id);
                        const values = lolRankApiValues[rank.id];
                        setDraft((current) => ({
                          ...current,
                          rankMin: rank.id === "todos" ? "" : rank.id,
                          rankMax: values ? values.join("|") : "",
                          page: 1,
                        }));
                      }}
                    >
                      {rank.img ? <img src={rank.img} alt="" /> : <strong>?</strong>}
                      <span>{rank.name}</span>
                    </button>
                  ))}
                </div>
              </FilterSection>

              <label className="crz-accounts-field"><span>Mínimo de campeões</span><input type="number" min="0" value={draft.championsMin} onChange={(e) => setField("championsMin", e.target.value)} /></label>
              <label className="crz-accounts-field"><span>Mínimo de skins</span><input type="number" min="0" value={draft.skinsMin} onChange={(e) => setField("skinsMin", e.target.value)} /></label>
              <label className="crz-accounts-field">
                <span>Região</span>
                <select value={draft.region} onChange={(e) => setField("region", e.target.value)}>
                  {lolRegions.map((region) => <option key={region.id} value={region.id}>{region.label}</option>)}
                </select>
              </label>
            </>
          )}

          {game === "fortnite" && (
            <>
              <label className="crz-accounts-field"><span>Mínimo de V-Bucks</span><input type="number" min="0" value={draft.vbucksMin} onChange={(e) => setField("vbucksMin", e.target.value)} /></label>
              <label className="crz-accounts-field"><span>Mínimo de skins</span><input type="number" min="0" value={draft.skinsMin} onChange={(e) => setField("skinsMin", e.target.value)} /></label>
            </>
          )}

          {game === "minecraft" && (
            <>
              <label className="crz-account-switch">
                <input type="checkbox" checked={draft.javaEdition === "1"} onChange={(e) => setField("javaEdition", e.target.checked ? "1" : "")} />
                <i /><span>Java Edition</span>
              </label>
              <label className="crz-account-switch">
                <input type="checkbox" checked={draft.bedrockEdition === "1"} onChange={(e) => setField("bedrockEdition", e.target.checked ? "1" : "")} />
                <i /><span>Bedrock Edition</span>
              </label>
              <label className="crz-accounts-field"><span>Mínimo de capas</span><input type="number" min="0" value={draft.capesMin} onChange={(e) => setField("capesMin", e.target.value)} /></label>
              <label className="crz-accounts-field"><span>Mínimo de Minecoins</span><input type="number" min="0" value={draft.minecoinsMin} onChange={(e) => setField("minecoinsMin", e.target.value)} /></label>
              <label className="crz-accounts-field"><span>Nível Hypixel mínimo</span><input type="number" min="0" value={draft.hypixelLevelMin} onChange={(e) => setField("hypixelLevelMin", e.target.value)} /></label>
            </>
          )}

          <FilterSection
            title="Faixa de Preço"
            icon={<span className="crz-account-filter-symbol">$</span>}
            open={priceOpen}
            onToggle={() => setPriceOpen((value) => !value)}
          >
            <RangePair
              min={draft.priceMin}
              max={draft.priceMax}
              prefix="R$"
              onMin={(value) => setField("priceMin", value)}
              onMax={(value) => setField("priceMax", value)}
            />
          </FilterSection>

          {game === "valorant" && (
            <FilterSection
              title="Valor do Inventário"
              icon={<span className="crz-account-filter-symbol">↗</span>}
              open={inventoryOpen}
              onToggle={() => setInventoryOpen((value) => !value)}
            >
              <RangePair
                min={draft.inventoryMin}
                max={draft.inventoryMax}
                onMin={(value) => setField("inventoryMin", value)}
                onMax={(value) => setField("inventoryMax", value)}
              />
            </FilterSection>
          )}

          {game !== "minecraft" && (
            <FilterSection
              title="Nível da Conta"
              icon={<span className="crz-account-filter-symbol">★</span>}
              open={levelOpen}
              onToggle={() => setLevelOpen((value) => !value)}
            >
              <RangePair
                min={draft.levelMin}
                max={draft.levelMax}
                onMin={(value) => setField("levelMin", value)}
                onMax={(value) => setField("levelMax", value)}
              />
            </FilterSection>
          )}
        </aside>

        <section className="crz-accounts-results" aria-live="polite">
          <header className="crz-accounts-results__head">
            <div>
              <span>CONTAS DISPONÍVEIS</span>
              <h2>{label}</h2>
            </div>
            <div className="crz-accounts-results__tools">
              <label>
                <span>Ordenar</span>
                <select value={draft.orderBy} onChange={(e) => setField("orderBy", e.target.value as AccountsMarketFilters["orderBy"])}>
                  <option value="pdate_to_down">Mais recentes</option>
                  <option value="price_to_up">Menor preço</option>
                  <option value="price_to_down">Maior preço</option>
                </select>
              </label>
              <div className="crz-accounts-results__count">
                <strong>{data?.totalItems ?? 0}</strong>
                <span>encontradas</span>
              </div>
            </div>
          </header>

          {loading ? (
            <div className="crz-accounts-state"><LoadingState label={"Buscando contas de " + label + "..."} /></div>
          ) : error ? (
            <div className="crz-accounts-state">
              <ErrorState title="Não foi possível carregar as contas" description={error} onRetry={() => setApplied((current) => ({ ...current }))} />
            </div>
          ) : !data?.items.length ? (
            <div className="crz-accounts-state">
              <EmptyState
                icon={<NeonIcon name="gamepad" size={34} />}
                title="Nenhuma conta encontrada"
                description="Tente remover alguns filtros ou alterar a busca."
              />
            </div>
          ) : (
            <>
              <div className="crz-accounts-grid">
                {data.items.map((item) => <AccountCard key={item.id} item={item} skinCatalog={skinCatalog} />)}
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

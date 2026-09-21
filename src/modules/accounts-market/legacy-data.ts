import type { AccountsMarketGame } from "./types";

const legacyAsset = (name: string) =>
  "https://raw.githubusercontent.com/futureproject971/crazzyproject/main/src/assets/" + name;

export const valorantRegions = [
  { id: "all", label: "Todas as regiões" },
  { id: "br", label: "Brasil" },
  { id: "eu", label: "Europa" },
  { id: "na", label: "América do Norte" },
  { id: "ap", label: "Ásia-Pacífico" },
  { id: "kr", label: "Coreia" },
  { id: "latam", label: "LATAM" },
];

export const lolRegions = [
  { id: "all", label: "Todas as regiões" },
  { id: "br", label: "Brasil" },
  { id: "euw", label: "Europa Oeste" },
  { id: "eune", label: "Europa Norte/Leste" },
  { id: "na", label: "América do Norte" },
  { id: "las", label: "LAS" },
  { id: "lan", label: "LAN" },
  { id: "oce", label: "Oceania" },
  { id: "tr", label: "Turquia" },
  { id: "ru", label: "Rússia" },
  { id: "jp", label: "Japão" },
  { id: "kr", label: "Coreia" },
];

export const valorantRankFilters = [
  { id: "todos", name: "Todos", img: legacyAsset("rank-unranked.png"), rmin: "", rmax: "" },
  { id: "ferro", name: "Ferro", img: legacyAsset("rank-ferro.png"), rmin: "3", rmax: "5" },
  { id: "bronze", name: "Bronze", img: legacyAsset("rank-bronze.png"), rmin: "6", rmax: "8" },
  { id: "prata", name: "Prata", img: legacyAsset("rank-prata.png"), rmin: "9", rmax: "11" },
  { id: "ouro", name: "Ouro", img: legacyAsset("rank-ouro.png"), rmin: "12", rmax: "14" },
  { id: "platina", name: "Platina", img: legacyAsset("rank-platina.png"), rmin: "15", rmax: "17" },
  { id: "diamante", name: "Diamante", img: legacyAsset("rank-diamante.png"), rmin: "18", rmax: "20" },
  { id: "ascendente", name: "Ascendente", img: legacyAsset("rank-ascendente.png"), rmin: "21", rmax: "23" },
  { id: "imortal", name: "Imortal", img: legacyAsset("rank-imortal.png"), rmin: "24", rmax: "26" },
  { id: "radiante", name: "Radiante", img: legacyAsset("rank-radiante-new.png"), rmin: "27", rmax: "27" },
] as const;

export const lolRankFilters = [
  { id: "todos", name: "Todos", img: null },
  { id: "iron", name: "Ferro", img: legacyAsset("lol-rank-ferro.png") },
  { id: "bronze", name: "Bronze", img: legacyAsset("lol-rank-bronze.webp") },
  { id: "silver", name: "Prata", img: legacyAsset("lol-rank-prata.png") },
  { id: "gold", name: "Ouro", img: legacyAsset("lol-rank-ouro.png") },
  { id: "platinum", name: "Platina", img: legacyAsset("lol-rank-platina.png") },
  { id: "emerald", name: "Esmeralda", img: legacyAsset("lol-rank-esmeralda.png") },
  { id: "diamond", name: "Diamante", img: legacyAsset("lol-rank-diamante.webp") },
  { id: "master", name: "Mestre+", img: legacyAsset("lol-rank-mestre.png") },
] as const;

export const lolRankApiValues: Record<string, string[]> = {
  iron: ["IRON IV", "IRON III", "IRON II", "IRON I"],
  bronze: ["BRONZE IV", "BRONZE III", "BRONZE II", "BRONZE I"],
  silver: ["SILVER IV", "SILVER III", "SILVER II", "SILVER I"],
  gold: ["GOLD IV", "GOLD III", "GOLD II", "GOLD I"],
  platinum: ["PLATINUM IV", "PLATINUM III", "PLATINUM II", "PLATINUM I"],
  emerald: ["EMERALD IV", "EMERALD III", "EMERALD II", "EMERALD I"],
  diamond: ["DIAMOND IV", "DIAMOND III", "DIAMOND II", "DIAMOND I"],
  master: ["MASTER I", "GRANDMASTER I", "CHALLENGER I"],
};

export const weapons = [
  { id: "todos", name: "Todas", img: null },
  { id: "ares", name: "Ares", img: legacyAsset("weapon-ares.png") },
  { id: "bandit", name: "Bandit", img: legacyAsset("weapon-bandit.png") },
  { id: "bucky", name: "Bucky", img: legacyAsset("weapon-bucky.png") },
  { id: "bulldog", name: "Bulldog", img: legacyAsset("weapon-bulldog.png") },
  { id: "classic", name: "Classic", img: legacyAsset("weapon-classic.png") },
  { id: "ghost", name: "Ghost", img: legacyAsset("weapon-ghost.png") },
  { id: "guardian", name: "Guardian", img: legacyAsset("weapon-guardian.png") },
  { id: "judge", name: "Judge", img: legacyAsset("weapon-judge.png") },
  { id: "marshal", name: "Marshal", img: legacyAsset("weapon-marshal.png") },
  { id: "odin", name: "Odin", img: legacyAsset("weapon-odin.png") },
  { id: "operator", name: "Operator", img: legacyAsset("weapon-operator.png") },
  { id: "outlaw", name: "Outlaw", img: legacyAsset("weapon-outlaw.png") },
  { id: "phantom", name: "Phantom", img: legacyAsset("weapon-phantom.png") },
  { id: "sheriff", name: "Sheriff", img: legacyAsset("weapon-sheriff.png") },
  { id: "shorty", name: "Shorty", img: legacyAsset("weapon-shorty.png") },
  { id: "spectre", name: "Spectre", img: legacyAsset("weapon-spectre.png") },
  { id: "stinger", name: "Stinger", img: legacyAsset("weapon-stinger.png") },
  { id: "vandal", name: "Vandal", img: legacyAsset("weapon-vandal.png") },
] as const;

export const gameTabs: Array<{ id: AccountsMarketGame; label: string }> = [
  { id: "valorant", label: "VALORANT" },
  { id: "lol", label: "League of Legends" },
  { id: "fortnite", label: "Fortnite" },
  { id: "minecraft", label: "Minecraft" },
];

export function valorantRankImage(rankValue: number | null) {
  if (rankValue == null) return legacyAsset("rank-unranked.png");
  if (rankValue >= 27) return legacyAsset("rank-radiante-new.png");
  if (rankValue >= 24) return legacyAsset("rank-imortal.png");
  if (rankValue >= 21) return legacyAsset("rank-ascendente.png");
  if (rankValue >= 18) return legacyAsset("rank-diamante.png");
  if (rankValue >= 15) return legacyAsset("rank-platina.png");
  if (rankValue >= 12) return legacyAsset("rank-ouro.png");
  if (rankValue >= 9) return legacyAsset("rank-prata.png");
  if (rankValue >= 6) return legacyAsset("rank-bronze.png");
  if (rankValue >= 3) return legacyAsset("rank-ferro.png");
  return legacyAsset("rank-unranked.png");
}

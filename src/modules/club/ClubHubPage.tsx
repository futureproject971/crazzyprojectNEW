"use client";

import { NeonIcon, PageHeader } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";

const clubModules = [
  {
    id: "rewards",
    title: "CRAZZY REWARDS",
    description: "Faz missão, farma ponto e pega tua recompensa.",
    href: "/club/rewards",
    icon: "crown" as const,
    tone: "blue",
    status: "Farma e recompensa",
  },
  {
    id: "luck",
    title: "CRAZZY LUCK",
    description: "Roleta, raspadinha e drop. A sorte vem no servidor, sem truque de palco.",
    href: "/club/luck",
    icon: "lightning" as const,
    tone: "pink",
    status: "Sorte no talo",
  },
  {
    id: "coupons",
    title: "MEUS CUPONS",
    description: "Teus cupons ficam aqui, prontos pra entrar no corre.",
    href: "/painel/cupons",
    icon: "featured" as const,
    tone: "gold",
    status: "Cupom no bolso",
  },
  {
    id: "rank",
    title: "CRAZZY RANK",
    description: "Sobe de nível, pega badge e deixa teu nome aceso na comunidade.",
    href: "/club/rank",
    icon: "community" as const,
    tone: "green",
    status: "Nome no topo",
  },
];

export function ClubHubPage() {
  const { user, loading } = useAuth();

  return (
    <main className="crz-club-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY CLUB"
          title="Teu QG de recompensa"
          description="Missão, sorte, cupom e rank no mesmo QG. Faz teu corre e deixa a barra subir."
          actions={
            user ? (
              <a className="crz-button crz-button--secondary crz-button--sm" href="/painel">
                MEU QG
              </a>
            ) : (
              <a className="crz-button crz-button--primary crz-button--sm" href="/login">
                COLAR NO CLUB
              </a>
            )
          }
        />

        <section className="crz-club-hero-card">
          <div className="crz-club-hero-card__glow" aria-hidden="true" />
          <div className="crz-club-hero-card__copy">
            <span>MEMBRO CRAZZY</span>
            <h2>{loading ? "Puxando teu CLUB..." : user ? "Chegou, " + (user.username || "membro") : "Entra aí e destrava o CLUB"}</h2>
            <p>
              Compra, missão, prêmio e benefício no mesmo corre. Teus dados sensíveis ficam fora da bagunça.
            </p>
          </div>
          <div className="crz-club-hero-card__mark">
            <NeonIcon name="crown" size={82} />
          </div>
        </section>

        <section className="crz-club-grid" aria-label="Módulos do CRAZZY CLUB">
          {clubModules.map((module) => (
            <a
              href={module.href}
              key={module.id}
              className={"crz-club-card crz-club-card--" + module.tone}
            >
              <div className="crz-club-card__icon">
                <NeonIcon name={module.icon} size={38} />
              </div>
              <div>
                <small>{module.status}</small>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
              </div>
              <span className="crz-club-card__arrow">→</span>
            </a>
          ))}
        </section>

        <section className="crz-club-security">
          <NeonIcon name="shield" size={28} />
          <div>
            <strong>Teu progresso fica colado na tua conta</strong>
            <span>Missão e prêmio passam pelo servidor. Sem jeitinho, sem prêmio fantasma.</span>
          </div>
        </section>
      </div>
    </main>
  );
}

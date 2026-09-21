"use client";

import { NeonIcon, PageHeader } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";

const clubModules = [
  {
    id: "rewards",
    title: "CRAZZY REWARDS",
    description: "Complete missões, assista conteúdos e resgate recompensas.",
    href: "/club/rewards",
    icon: "crown" as const,
    tone: "blue",
    status: "Missões e recompensas",
  },
  {
    id: "luck",
    title: "CRAZZY LUCK",
    description: "Roleta, raspadinha, drops e prêmios com resultado validado no servidor.",
    href: "/club/luck",
    icon: "lightning" as const,
    tone: "pink",
    status: "Roleta e raspadinha",
  },
  {
    id: "coupons",
    title: "MEUS CUPONS",
    description: "Veja cupons liberados, regras de uso e validade.",
    href: "/painel/cupons",
    icon: "featured" as const,
    tone: "gold",
    status: "Descontos e prêmios",
  },
  {
    id: "rank",
    title: "CRAZZY RANK",
    description: "Acompanhe badges, progressão e destaques da comunidade.",
    href: "/club/rank",
    icon: "community" as const,
    tone: "green",
    status: "Ranking e badges",
  },
];

export function ClubHubPage() {
  const { user, loading } = useAuth();

  return (
    <main className="crz-club-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY CLUB"
          title="Seu hub de recompensas"
          description="Missões, sorteios, cupons e progressão reunidos em um só lugar."
          actions={
            user ? (
              <a className="crz-button crz-button--secondary crz-button--sm" href="/painel">
                Meu painel
              </a>
            ) : (
              <a className="crz-button crz-button--primary crz-button--sm" href="/login">
                Entrar no CLUB
              </a>
            )
          }
        />

        <section className="crz-club-hero-card">
          <div className="crz-club-hero-card__glow" aria-hidden="true" />
          <div className="crz-club-hero-card__copy">
            <span>MEMBRO CRAZZY</span>
            <h2>{loading ? "Carregando seu CLUB..." : user ? "Bem-vindo, " + (user.username || "membro") : "Entre para desbloquear o CLUB"}</h2>
            <p>
              O CRAZZY CLUB conecta suas compras, missões, recompensas e benefícios sem misturar dados sensíveis no navegador.
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
            <strong>Progressão vinculada à sua conta</strong>
            <span>Missões, claims e prêmios usam sessão autenticada e validação no servidor.</span>
          </div>
        </section>
      </div>
    </main>
  );
}

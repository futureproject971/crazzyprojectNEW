"use client";

import { useState } from "react";
import { Badge, NeonIcon } from "@/core/design-system";
import { useAuth } from "./AuthProvider";

const errorCopy: Record<string, string> = {
  missing_code: "O login voltou sem o código. Tenta entrar de novo.",
  oauth_exchange: "A sessão não fechou o round. Entra de novo.",
  banned: "Essa conta tá bloqueada de entrar por aqui.",
  signup_disabled: "Cadastro novo tá fechado por enquanto.",
};

export function AuthPage({
  nextPath = "/",
  initialError = "",
}: {
  nextPath?: string;
  initialError?: string;
}) {
  const {
    user,
    loading,
    signIn,
    linkDiscord,
    discordEnabled,
    googleEnabled,
  } = useAuth();
  const [busy, setBusy] = useState<"discord" | "google" | null>(null);
  const [error, setError] = useState(
    errorCopy[initialError] || (initialError ? "O login tropeçou. Tenta mais uma." : "")
  );

  const login = async (provider: "discord" | "google") => {
    setBusy(provider);
    setError("");
    try {
      await signIn(provider, nextPath);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Não consegui abrir o login agora."
      );
      setBusy(null);
    }
  };

  return (
    <main className="crz-auth-page">
      <div className="crz-auth-backdrop" aria-hidden="true" />

      <section className="crz-auth-card">
        <a className="crz-auth-brand" href="/">
          <img src="/brand/crazzy-logo-navbar.png" alt="CRAZZY PROJECT" />
        </a>

        <div className="crz-auth-heading">
          <Badge tone="blue">CRAZZY AUTH</Badge>
          <h1>{user ? "Tu já tá dentro" : "COLA NA CRAZZY PROJECT"}</h1>
          <p>
            O site continua público. A conta é usada para checkout, pedidos,
            chat, tickets e outras áreas privadas.
          </p>
        </div>

        {loading ? (
          <div className="crz-auth-loading">
            <i />
            Verificando sessão...
          </div>
        ) : user ? (
          <div className="crz-auth-current">
            <div className="crz-auth-avatar">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <NeonIcon name="verified" size={30} />}
            </div>
            <div>
              <strong>{user.username}</strong>
              <span>{user.email || "Conta no mapa"}</span>
              {user.discord.connected ? (
                <small>
                  Discord conectado
                  {user.discord.guildId
                    ? user.discord.guildMember
                      ? " • servidor verificado"
                      : " • fora do servidor no último login"
                    : ""}
                </small>
              ) : (
                <small>Discord ainda tá fora do squad</small>
              )}
            </div>
            <div className="crz-auth-current__actions">
              {!user.discord.connected && discordEnabled && (
                <button
                  type="button"
                  onClick={() => void linkDiscord(nextPath)}
                >
                  Conectar Discord
                </button>
              )}
              <a href={nextPath}>BORA →</a>
            </div>
          </div>
        ) : (
          <>
            <div className="crz-auth-providers">
              {discordEnabled && (
                <button
                  type="button"
                  className="crz-auth-provider crz-auth-provider--discord"
                  disabled={busy !== null}
                  onClick={() => void login("discord")}
                >
                  <img src="/icons/brand-discord.svg" alt="" aria-hidden="true" />
                  <span>
                    <strong>{busy === "discord" ? "Chamando o Discord..." : "ENTRAR COM DISCORD"}</strong>
                    <small>Tua identidade principal + teu status no servidor.</small>
                  </span>
                  <b>→</b>
                </button>
              )}

              {googleEnabled && (
                <button
                  type="button"
                  className="crz-auth-provider"
                  disabled={busy !== null}
                  onClick={() => void login("google")}
                >
                  <img src="/icons/brand-google.svg" alt="" aria-hidden="true" />
                  <span>
                    <strong>{busy === "google" ? "Chamando o Google..." : "ENTRAR COM GOOGLE"}</strong>
                    <small>Plano B pra entrar sem drama.</small>
                  </span>
                  <b>→</b>
                </button>
              )}
            </div>

            {error && (
              <div className="crz-auth-error">
                <NeonIcon name="shield" size={21} />
                <span>{error}</span>
              </div>
            )}

            <div className="crz-auth-security">
              <NeonIcon name="shield" size={25} />
              <div>
                <strong>Entrada segura, sem novela</strong>
                <span>
                  O token Discord é usado apenas durante o callback para consultar
                  identidade/guilds e não é salvo na nossa base.
                </span>
              </div>
            </div>
          </>
        )}

        <footer>
          <a href="/">← VOLTAR PRO MAPA</a>
          <span>Entrando, só as áreas privadas recebem tua sessão. O resto fica na moral.</span>
        </footer>
      </section>
    </main>
  );
}

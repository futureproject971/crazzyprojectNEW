"use client";

import { useState } from "react";
import { Badge, NeonIcon } from "@/core/design-system";
import { useAuth } from "./AuthProvider";

const errorCopy: Record<string, string> = {
  missing_code: "O provedor não devolveu o código de autenticação.",
  oauth_exchange: "A sessão não pôde ser criada. Tente entrar novamente.",
  banned: "Esta conta está bloqueada para acesso à plataforma.",
  signup_disabled: "Novos cadastros estão desativados no Auth.",
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
    errorCopy[initialError] || (initialError ? "Não foi possível concluir o login." : "")
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
          : "Não foi possível abrir o provedor de login."
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
          <h1>{user ? "Você já está conectado" : "Entrar na CRAZZY PROJECT"}</h1>
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
              <span>{user.email || "Conta conectada"}</span>
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
                <small>Discord ainda não conectado</small>
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
              <a href={nextPath}>Continuar →</a>
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
                    <strong>{busy === "discord" ? "Abrindo Discord..." : "Entrar com Discord"}</strong>
                    <small>Identidade principal + status do servidor.</small>
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
                    <strong>{busy === "google" ? "Abrindo Google..." : "Entrar com Google"}</strong>
                    <small>Opção alternativa de autenticação.</small>
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
                <strong>Acesso seguro à sua conta</strong>
                <span>
                  O token Discord é usado apenas durante o callback para consultar
                  identidade/guilds e não é salvo na nossa base.
                </span>
              </div>
            </div>
          </>
        )}

        <footer>
          <a href="/">← Voltar para a loja</a>
          <span>Ao continuar, você autentica apenas as áreas privadas.</span>
        </footer>
      </section>
    </main>
  );
}

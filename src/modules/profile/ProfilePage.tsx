"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  NeonIcon,
  Panel,
} from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";
import type {
  ProfileAvatarSource,
  ProfilePreferencesInput,
  ProfileSnapshot,
} from "./types";

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function roleTone(status: string) {
  if (status === "granted") return "green" as const;
  if (status === "failed" || status === "revoked") return "pink" as const;
  return "gold" as const;
}

const presetColors = [
  "#0000FF",
  "#0A84FF",
  "#5B5DFF",
  "#7B2CFF",
  "#00AEEF",
  "#00C58E",
  "#FF2D7A",
  "#F59E0B",
];

export function ProfilePage() {
  const { signIn, linkDiscord } = useAuth();
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discordBusy, setDiscordBusy] = useState(false);
  const [form, setForm] = useState<ProfilePreferencesInput>({
    displayName: null,
    bio: null,
    primaryColor: "#0000FF",
    avatarSource: "auto",
  });

  const load = async () => {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/profile", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível carregar o perfil.");
      }

      const next = payload as ProfileSnapshot;
      setSnapshot(next);
      setForm({
        displayName: next.preferences.displayName,
        bio: next.preferences.bio,
        primaryColor: next.preferences.primaryColor,
        avatarSource: next.preferences.avatarSource,
      });
      setState("ready");
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Falha ao carregar perfil."
      );
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const previewAvatar = useMemo(() => {
    if (!snapshot) return null;
    if (form.avatarSource === "discord") {
      return snapshot.account.discordAvatarUrl || snapshot.account.profileAvatarUrl;
    }
    if (form.avatarSource === "crazzy") {
      return snapshot.account.profileAvatarUrl || snapshot.account.discordAvatarUrl;
    }
    return snapshot.account.profileAvatarUrl || snapshot.account.discordAvatarUrl;
  }, [snapshot, form.avatarSource]);

  const save = async () => {
    if (!snapshot) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!response.ok) {
        const messages: Record<string, string> = {
          INVALID_DISPLAY_NAME: "O nome precisa ter entre 2 e 32 caracteres.",
          BIO_TOO_LONG: "A bio pode ter no máximo 280 caracteres.",
          INVALID_PRIMARY_COLOR: "Escolha uma cor hexadecimal válida.",
          INVALID_AVATAR_SOURCE: "Fonte de avatar inválida.",
        };
        throw new Error(messages[payload?.error] || payload?.error || "Falha ao salvar.");
      }

      setSnapshot((current) => {
        if (!current) return current;
        const displayName =
          payload.preferences.displayName || current.account.username;
        const avatarSource = payload.preferences.avatarSource as ProfileAvatarSource;
        const avatarUrl =
          avatarSource === "discord"
            ? current.account.discordAvatarUrl || current.account.profileAvatarUrl
            : current.account.profileAvatarUrl || current.account.discordAvatarUrl;

        return {
          ...current,
          account: {
            ...current.account,
            displayName,
            avatarUrl,
          },
          preferences: payload.preferences,
        };
      });

      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const syncDiscord = async () => {
    setDiscordBusy(true);
    setError("");
    try {
      if (snapshot?.discord.connected) {
        await signIn("discord", "/perfil");
      } else {
        await linkDiscord("/perfil");
      }
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Não foi possível abrir o Discord."
      );
      setDiscordBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <main className="crz-profile-page crz-profile-state">
        <LoadingState label="Montando seu perfil CRAZZY..." />
      </main>
    );
  }

  if (state === "error" || !snapshot) {
    return (
      <main className="crz-profile-page crz-profile-state">
        <ErrorState
          title="Seu perfil não carregou"
          description={error || "Tente novamente."}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  const accent = editing ? form.primaryColor : snapshot.preferences.primaryColor;
  const displayName = editing
    ? form.displayName || snapshot.account.username
    : snapshot.account.displayName;
  const avatarUrl = editing ? previewAvatar : snapshot.account.avatarUrl;

  const profileStyle = {
    "--crz-profile-color": accent,
  } as CSSProperties;

  return (
    <main className="crz-profile-page" style={profileStyle}>
      <section className="crz-profile-stage">
        <div className="crz-container crz-profile-layout">
          <section className="crz-profile-card">
            <div className="crz-profile-card__banner">
              <div className="crz-profile-card__banner-grid" />
            </div>

            <div className="crz-profile-card__identity">
              <div className="crz-profile-card__avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" />
                ) : (
                  <NeonIcon name="verified" size={48} />
                )}
                <span className="crz-profile-card__status" title="Conta ativa" />
              </div>

              <div className="crz-profile-card__actions">
                <Button
                  variant={editing ? "ghost" : "secondary"}
                  onClick={() => {
                    if (editing) {
                      setForm({
                        displayName: snapshot.preferences.displayName,
                        bio: snapshot.preferences.bio,
                        primaryColor: snapshot.preferences.primaryColor,
                        avatarSource: snapshot.preferences.avatarSource,
                      });
                    }
                    setEditing((value) => !value);
                  }}
                >
                  {editing ? "Cancelar" : "Editar perfil"}
                </Button>
              </div>
            </div>

            <div className="crz-profile-card__body">
              <div className="crz-profile-card__name">
                <small>CRAZZY PROFILE</small>
                <h1>{displayName}</h1>
                <span>@{snapshot.account.username}</span>
              </div>

              <div className="crz-profile-badges">
                {snapshot.badges.map((item) => (
                  <Badge key={item.id} tone={item.tone}>
                    {item.label}
                  </Badge>
                ))}
              </div>

              <div className="crz-profile-about">
                <strong>SOBRE MIM</strong>
                <p>
                  {(editing ? form.bio : snapshot.preferences.bio) ||
                    "Esse usuário ainda não escreveu uma bio."}
                </p>
              </div>

              <div className="crz-profile-member">
                <strong>MEMBRO DESDE</strong>
                <span>{date(snapshot.account.createdAt)}</span>
              </div>

              <div className="crz-profile-app-roles">
                <strong>ROLES CRAZZY</strong>
                <div>
                  {snapshot.appRoles.map((role) => (
                    <span key={role}>{role.toUpperCase()}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="crz-profile-side">
            {editing ? (
              <Panel className="crz-profile-editor">
                <header>
                  <div>
                    <small>PERSONALIZAÇÃO</small>
                    <h2>Editar perfil</h2>
                  </div>
                  <NeonIcon name="verified" size={24} />
                </header>

                <label>
                  <span>Nome de exibição</span>
                  <input
                    value={form.displayName || ""}
                    maxLength={32}
                    placeholder={snapshot.account.username}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        displayName: event.target.value || null,
                      }))
                    }
                  />
                  <small>{(form.displayName || "").length}/32</small>
                </label>

                <label>
                  <span>Bio</span>
                  <textarea
                    value={form.bio || ""}
                    maxLength={280}
                    rows={5}
                    placeholder="Fale um pouco sobre você..."
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bio: event.target.value || null,
                      }))
                    }
                  />
                  <small>{(form.bio || "").length}/280</small>
                </label>

                <div className="crz-profile-color-field">
                  <span>Cor principal</span>
                  <div className="crz-profile-color-row">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          primaryColor: event.target.value.toUpperCase(),
                        }))
                      }
                    />
                    <code>{form.primaryColor}</code>
                  </div>
                  <div className="crz-profile-color-presets">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={"Usar cor " + color}
                        className={form.primaryColor === color ? "is-active" : ""}
                        style={{ background: color }}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            primaryColor: color,
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>

                <label>
                  <span>Avatar</span>
                  <select
                    value={form.avatarSource}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        avatarSource: event.target.value as ProfileAvatarSource,
                      }))
                    }
                  >
                    <option value="auto">Automático</option>
                    <option value="crazzy">Conta CRAZZY</option>
                    <option value="discord">Discord</option>
                  </select>
                  <small>O fallback é automático quando uma fonte não possui avatar.</small>
                </label>

                <Button
                  disabled={saving}
                  onClick={() => void save()}
                  leadingIcon={<NeonIcon name="verified" size={18} />}
                >
                  {saving ? "Salvando..." : "Salvar perfil"}
                </Button>
              </Panel>
            ) : (
              <>
                <div className="crz-profile-stats">
                  {[
                    ["Produtos", snapshot.stats.entitlements, "cube"],
                    ["Ativos", snapshot.stats.activeEntitlements, "verified"],
                    ["Compras", snapshot.stats.completedPayments, "lightning"],
                    ["Cargos", snapshot.stats.grantedDiscordRoles, "community"],
                  ].map(([label, value, icon]) => (
                    <Panel className="crz-profile-stat" key={String(label)}>
                      <NeonIcon
                        name={icon as "cube" | "verified" | "lightning" | "community"}
                        size={24}
                      />
                      <div>
                        <strong>{value}</strong>
                        <span>{label}</span>
                      </div>
                    </Panel>
                  ))}
                </div>

                <Panel className="crz-profile-panel">
                  <header>
                    <div>
                      <small>CONEXÃO</small>
                      <h2>Discord</h2>
                    </div>
                    <Badge
                      tone={
                        snapshot.discord.connected
                          ? snapshot.discord.guildMember
                            ? "green"
                            : "blue"
                          : "neutral"
                      }
                    >
                      {snapshot.discord.connected
                        ? snapshot.discord.guildMember
                          ? "VERIFICADO"
                          : "CONECTADO"
                        : "NÃO CONECTADO"}
                    </Badge>
                  </header>

                  <div className="crz-profile-discord">
                    <div className="crz-profile-discord__avatar">
                      {snapshot.account.discordAvatarUrl ? (
                        <img src={snapshot.account.discordAvatarUrl} alt="" />
                      ) : (
                        <img src="/icons/brand-discord.svg" alt="" />
                      )}
                    </div>
                    <div>
                      <strong>
                        {snapshot.discord.globalName ||
                          snapshot.discord.username ||
                          "Discord não conectado"}
                      </strong>
                      <span>
                        {snapshot.discord.username
                          ? "@" + snapshot.discord.username
                          : "Conecte para sincronizar identidade e cargos."}
                      </span>
                      {snapshot.discord.lastCheckedAt && (
                        <small>
                          Último sync: {date(snapshot.discord.lastCheckedAt)}
                        </small>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    disabled={discordBusy}
                    onClick={() => void syncDiscord()}
                    leadingIcon={<NeonIcon name="community" size={18} />}
                  >
                    {discordBusy
                      ? "Abrindo Discord..."
                      : snapshot.discord.connected
                        ? "Atualizar Discord"
                        : "Conectar Discord"}
                  </Button>
                </Panel>

                <Panel className="crz-profile-panel">
                  <header>
                    <div>
                      <small>BENEFÍCIOS</small>
                      <h2>Cargos Discord</h2>
                    </div>
                    <Badge tone="blue">{snapshot.discordRoles.length}</Badge>
                  </header>

                  {!snapshot.discordRoles.length ? (
                    <div className="crz-profile-empty-roles">
                      <NeonIcon name="community" size={31} />
                      <span>Nenhum cargo de produto registrado ainda.</span>
                    </div>
                  ) : (
                    <div className="crz-profile-role-list">
                      {snapshot.discordRoles.map((role) => (
                        <article key={role.id}>
                          <span className="crz-profile-role-dot" />
                          <strong>{role.roleName}</strong>
                          <Badge tone={roleTone(role.status)}>
                            {role.status.toUpperCase()}
                          </Badge>
                        </article>
                      ))}
                    </div>
                  )}
                </Panel>
              </>
            )}
          </div>
        </div>
      </section>

      {error && state === "ready" && (
        <div className="crz-profile-inline-error">
          <NeonIcon name="shield" size={20} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>×</button>
        </div>
      )}
    </main>
  );
}

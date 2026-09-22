"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/AuthProvider";
import { CallLobby } from "./CallLobby";
import { CallRoom } from "./CallRoom";
import type {
  CallMediaPreferences,
  CallRoomPreview,
  CallRoomSnapshot,
} from "./types";

type Credentials = {
  token: string;
  url: string;
  roomName: string;
};

function messageFor(error?: string) {
  const value = String(error || "");
  if (value.includes("ROOM_NOT_FOUND")) return "Sala não encontrada.";
  if (value.includes("ROOM_ENDED")) return "Esta sala já foi encerrada.";
  if (value.includes("ROOM_DISABLED")) return "Esta sala foi desativada.";
  if (value.includes("ROOM_LOCKED")) return "Esta sala está bloqueada pelo host.";
  if (value.includes("ROOM_FULL")) return "Sala lotada.";
  if (value.includes("PARTICIPANT_KICKED")) return "Você foi removido pelo host.";
  if (value.includes("LIVEKIT_NOT_CONFIGURED")) {
    return "O servidor de mídia da CRAZZY CALL ainda não foi configurado.";
  }
  return "Não foi possível entrar na sala.";
}

export function CallExperience({ code }: { code: string }) {
  const { user, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<CallRoomPreview | null>(null);
  const [snapshot, setSnapshot] = useState<CallRoomSnapshot | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [preferences, setPreferences] = useState<CallMediaPreferences>({
    microphone: false,
    camera: false,
  });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    if (!user) return;
    setState("loading");
    const response = await fetch(
      "/api/call/preview?code=" + encodeURIComponent(code),
      { cache: "no-store" }
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(messageFor(payload.error));
      setState("error");
      return;
    }

    setPreview(payload.room as CallRoomPreview);
    setState("ready");
  }, [code, user]);

  useEffect(() => {
    if (authLoading) return;
    const next = "/call/" + encodeURIComponent(code);
    if (!user || !user.discord.connected) {
      window.location.assign("/login?next=" + encodeURIComponent(next));
      return;
    }
    if (user.discord.guildId && !user.discord.guildMember) {
      window.location.assign(
        "/login?next=" +
          encodeURIComponent(next) +
          "&error=discord_guild_required"
      );
      return;
    }
    void loadPreview();
  }, [authLoading, code, loadPreview, user]);

  const join = async (nextPreferences: CallMediaPreferences) => {
    if (!user || joining) return;
    setJoining(true);
    setError(null);
    setPreferences(nextPreferences);

    try {
      const joinResponse = await fetch("/api/call/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const joinPayload = await joinResponse.json().catch(() => ({}));
      if (!joinResponse.ok || !joinPayload.snapshot) {
        setError(messageFor(joinPayload.error));
        return;
      }

      const tokenResponse = await fetch("/api/call/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const tokenPayload = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok) {
        setError(messageFor(tokenPayload.error));
        return;
      }

      setSnapshot(joinPayload.snapshot as CallRoomSnapshot);
      setCredentials(tokenPayload as Credentials);
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || state === "loading") {
    return (
      <main className="crz-call-state">
        <span className="crz-spinner" />
        <strong>Preparando CRAZZY CALL...</strong>
      </main>
    );
  }

  if (!user || !user.discord.connected) return null;

  if (state === "error" || !preview) {
    return (
      <main className="crz-call-state">
        <img src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT" />
        <strong>{error || "Não foi possível carregar esta sala."}</strong>
        <a className="crz-button crz-button--secondary crz-button--md" href="/call">
          Voltar para CRAZZY CALL
        </a>
      </main>
    );
  }

  if (snapshot && credentials) {
    return (
      <CallRoom
        initialSnapshot={snapshot}
        credentials={credentials}
        preferences={preferences}
        user={user}
      />
    );
  }

  return (
    <CallLobby
      room={preview}
      user={user}
      busy={joining}
      error={error}
      onJoin={(next) => void join(next)}
    />
  );
}

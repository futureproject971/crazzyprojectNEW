"use client";

import { useCallback, useEffect, useState } from "react";
import { useGlobalMusic, type GlobalTrack } from "@/core/music/GlobalMusicProvider";
import { Youtube } from "./icons";

type YouTubeStatus = {
  connected: boolean;
  account?: {
    email?: string | null;
    displayName?: string | null;
    channelId?: string | null;
    channelTitle?: string | null;
  } | null;
};

type YouTubeLibrary = {
  likesPlaylistId?: string | null;
  playlists?: Array<{
    id: string;
    title: string;
    thumbnail?: string | null;
    itemCount: number;
  }>;
};

export default function YouTubeAccount() {
  const player = useGlobalMusic();
  const [status, setStatus] = useState<YouTubeStatus>({ connected: false });
  const [library, setLibrary] = useState<YouTubeLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/mtsounds/native/youtube/status", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      setStatus({
        connected: Boolean(payload.connected),
        account: payload.account || null,
      });

      if (payload.connected) {
        const libraryResponse = await fetch(
          "/api/mtsounds/native/youtube/library",
          { cache: "no-store" }
        );
        const libraryPayload = await libraryResponse.json().catch(() => ({}));
        if (libraryResponse.ok) setLibrary(libraryPayload);
      } else {
        setLibrary(null);
      }
    } catch {
      setStatus({ connected: false });
      setLibrary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const importPlaylist = async (
    playlistId: string,
    title: string,
    autoplay = false
  ) => {
    if (!playlistId || busy) return;
    setBusy(playlistId);
    setMessage("");

    try {
      const response = await fetch(
        "/api/mtsounds/native/youtube/library?playlistId=" +
          encodeURIComponent(playlistId),
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "IMPORT_FAILED");

      const tracks = (payload.tracks || []) as GlobalTrack[];
      if (!tracks.length) throw new Error("PLAYLIST_EMPTY");

      tracks.forEach((track) => player.addToPlaylist(track));
      if (autoplay) {
        player.playNow(tracks[0]);
        tracks.slice(1).forEach((track) => player.enqueue(track));
      } else {
        tracks.forEach((track) => player.enqueue(track));
      }

      setMessage(
        tracks.length +
          " música(s) de “" +
          title +
          "” adicionadas" +
          (autoplay ? " e tocando agora." : ".")
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? "Falha ao importar: " + error.message
          : "Falha ao importar."
      );
    } finally {
      setBusy("");
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy("disconnect");
    setMessage("");

    try {
      const response = await fetch(
        "/api/mtsounds/native/youtube/disconnect",
        { method: "POST" }
      );
      if (!response.ok) throw new Error();
      setMessage("Conta do YouTube desvinculada.");
      await loadStatus();
    } catch {
      setMessage("Não foi possível desvincular agora.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="wrap mts-youtube-account" id="youtube-account">
      <div className="mts-youtube-account__head">
        <div>
          <span className="eyebrow">
            <Youtube size={16}/> YOUTUBE CONECTADO
          </span>
          <h2>
            Seu gosto. <span>Sua fila.</span>
          </h2>
          <p>
            Vincule o YouTube para carregar playlists e músicas curtidas dentro
            do player global da CRAZZY PROJECT.
          </p>
        </div>

        {loading ? (
          <span className="mts-youtube-account__state">Verificando...</span>
        ) : status.connected ? (
          <div className="mts-youtube-account__state is-connected">
            <i />
            <span>
              <strong>
                {status.account?.channelTitle ||
                  status.account?.displayName ||
                  "YouTube conectado"}
              </strong>
              <small>{status.account?.email || "Conta vinculada"}</small>
            </span>
          </div>
        ) : (
          <a
            className="btn-primary"
            href="/api/mtsounds/native/youtube/connect"
          >
            <Youtube size={17}/> Vincular YouTube
          </a>
        )}
      </div>

      {status.connected && (
        <div className="mts-youtube-account__body">
          {library?.likesPlaylistId && (
            <article className="mts-youtube-account__likes">
              <div>
                <span>❤️</span>
                <div>
                  <strong>Músicas curtidas</strong>
                  <small>
                    Toca em sequência usando o player global do site.
                  </small>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  void importPlaylist(
                    String(library.likesPlaylistId),
                    "Músicas curtidas",
                    true
                  )
                }
              >
                {busy === library.likesPlaylistId
                  ? "Carregando..."
                  : "▶ Tocar curtidas"}
              </button>
            </article>
          )}

          <div className="mts-youtube-account__playlists">
            {(library?.playlists || []).map((playlist) => (
              <article key={playlist.id}>
                {playlist.thumbnail ? (
                  <img src={playlist.thumbnail} alt="" loading="lazy" />
                ) : (
                  <span className="mts-youtube-account__fallback">♫</span>
                )}
                <div>
                  <strong>{playlist.title}</strong>
                  <small>{playlist.itemCount} música(s)</small>
                </div>
                <div>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void importPlaylist(
                        playlist.id,
                        playlist.title,
                        true
                      )
                    }
                  >
                    ▶ Tocar
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void importPlaylist(
                        playlist.id,
                        playlist.title,
                        false
                      )
                    }
                  >
                    ＋ Fila
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="mts-youtube-account__footer">
            <button
              type="button"
              className="is-danger"
              disabled={Boolean(busy)}
              onClick={() => void disconnect()}
            >
              Desvincular YouTube
            </button>
            {message && <span>{message}</span>}
          </div>
        </div>
      )}

      {!status.connected && !loading && (
        <div className="mts-youtube-account__note">
          <strong>O que essa conexão faz?</strong>
          <span>
            A CRAZZY PROJECT lê somente sua biblioteca do YouTube para montar a
            fila. O player continua reproduzindo pelo próprio YouTube.
          </span>
        </div>
      )}

      {message && !status.connected && (
        <p className="mts-youtube-account__message">{message}</p>
      )}
    </section>
  );
}

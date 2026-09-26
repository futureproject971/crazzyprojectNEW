"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LocalAudioTrack,
  LocalVideoTrack,
  Room,
  Track,
} from "livekit-client";
import {
  postCaptureConstraints,
  screenCaptureOptions,
  screenPublishOptions,
  type ScreenShareProfile,
} from "./profiles";

type LocalScreenTracks = {
  video: LocalVideoTrack;
  audio: LocalAudioTrack | null;
  ended: () => void;
};

export type LocalScreenSettings = {
  width: number;
  height: number;
  fps: number;
  audio: boolean;
};

function readSettings(track: LocalVideoTrack, audio: LocalAudioTrack | null): LocalScreenSettings {
  const settings = track.mediaStreamTrack.getSettings();
  return {
    width: Number(settings.width || 0),
    height: Number(settings.height || 0),
    fps: Math.round(Number(settings.frameRate || 0)),
    audio: Boolean(audio),
  };
}

export function useScreenShareEngine({
  room,
  profile,
  withAudio,
  enabled,
  onNotice,
  onEnded,
}: {
  room: Room | null;
  profile: ScreenShareProfile;
  withAudio: boolean;
  enabled: boolean;
  onNotice: (message: string) => void;
  onEnded: () => void;
}) {
  const tracksRef = useRef<LocalScreenTracks | null>(null);
  const stoppingRef = useRef(false);
  const [active, setActive] = useState(false);
  const [settings, setSettings] = useState<LocalScreenSettings | null>(null);

  const stop = useCallback(async () => {
    const current = tracksRef.current;
    if (!current || stoppingRef.current) return;
    stoppingRef.current = true;
    tracksRef.current = null;

    current.video.mediaStreamTrack.removeEventListener("ended", current.ended);
    try {
      if (room) {
        await room.localParticipant.unpublishTrack(current.video, true).catch(() => undefined);
        if (current.audio) {
          await room.localParticipant.unpublishTrack(current.audio, true).catch(() => undefined);
        }
      } else {
        current.video.stop();
        current.audio?.stop();
      }
    } finally {
      setActive(false);
      setSettings(null);
      stoppingRef.current = false;
    }
  }, [room]);

  const start = useCallback(async () => {
    if (!room || !enabled || active) return false;

    let video: LocalVideoTrack | null = null;
    let audio: LocalAudioTrack | null = null;

    try {
      const tracks = await room.localParticipant.createScreenTracks(
        screenCaptureOptions(profile, withAudio),
      );

      video = tracks.find((track) => track instanceof LocalVideoTrack) as LocalVideoTrack | undefined || null;
      audio = tracks.find((track) => track instanceof LocalAudioTrack) as LocalAudioTrack | undefined || null;

      if (!video) throw new Error("SCREEN_VIDEO_MISSING");

      try {
        await video.mediaStreamTrack.applyConstraints(postCaptureConstraints(profile));
      } catch {
        // Browsers may reject part of the ideal constraint set. Keep the native capture.
      }

      video.mediaStreamTrack.contentHint = profile === "game" ? "motion" : "detail";

      const ended = () => {
        void stop().finally(onEnded);
      };
      video.mediaStreamTrack.addEventListener("ended", ended, { once: true });

      tracksRef.current = { video, audio, ended };

      await room.localParticipant.publishTrack(video, {
        ...screenPublishOptions(profile),
        source: Track.Source.ScreenShare,
      });

      if (audio) {
        await room.localParticipant.publishTrack(audio, {
          source: Track.Source.ScreenShareAudio,
        });
      }

      setSettings(readSettings(video, audio));
      setActive(true);

      if (withAudio && !audio) {
        onNotice(
          "Seu navegador não forneceu áudio da tela. Compartilhe uma aba/aplicativo compatível ou deixe Áudio da tela desligado.",
        );
      }

      return true;
    } catch (error) {
      if (video) video.stop();
      if (audio) audio.stop();
      tracksRef.current = null;
      setActive(false);
      setSettings(null);

      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError") {
        onNotice("O compartilhamento foi cancelado ou bloqueado pelo navegador.");
      } else {
        onNotice("Não foi possível iniciar o compartilhamento de tela.");
      }
      return false;
    }
  }, [active, enabled, onEnded, onNotice, profile, room, stop, withAudio]);

  const toggle = useCallback(async () => {
    if (active) {
      await stop();
      return false;
    }
    return start();
  }, [active, start, stop]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      const current = tracksRef.current;
      if (current) setSettings(readSettings(current.video, current.audio));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    return () => {
      const current = tracksRef.current;
      if (!current) return;
      current.video.mediaStreamTrack.removeEventListener("ended", current.ended);
      current.video.stop();
      current.audio?.stop();
      tracksRef.current = null;
    };
  }, []);

  return {
    active,
    settings,
    start,
    stop,
    toggle,
  };
}

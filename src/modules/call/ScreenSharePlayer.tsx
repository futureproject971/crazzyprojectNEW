"use client";

import { useEffect, useRef } from "react";
import { VideoQuality } from "livekit-client";
import type { ActiveScreenShare } from "./media-types";

function attachTrack(
  track: ActiveScreenShare["videoTrack"],
  element: HTMLVideoElement | null
) {
  if (!element) return () => undefined;
  track.attach(element);
  return () => {
    track.detach(element);
  };
}

export function ScreenSharePlayer({
  share,
  muted,
  volume,
  quality,
  fps,
}: {
  share: ActiveScreenShare | null;
  muted: boolean;
  volume: number;
  quality: "auto" | "720p" | "1080p";
  fps: 30 | 60;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!share) return;
    return attachTrack(share.videoTrack, videoRef.current);
  }, [share]);

  useEffect(() => {
    const element = audioRef.current;
    const audioTrack = share?.audioTrack;
    if (!element || !audioTrack) return;
    audioTrack.attach(element);
    return () => {
      audioTrack.detach(element);
    };
  }, [share]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = muted;
    audioRef.current.volume = Math.min(1, Math.max(0, volume));
  }, [muted, volume]);

  useEffect(() => {
    const publication = share?.remotePublication;
    if (!publication) return;
    if (quality === "720p") publication.setVideoQuality(VideoQuality.MEDIUM);
    if (quality === "1080p") publication.setVideoQuality(VideoQuality.HIGH);
    publication.setVideoFPS(fps);
  }, [fps, quality, share]);

  if (!share) {
    return (
      <div className="crz-call-empty-player">
        <strong>Esperando uma transmissão</strong>
        <span>Quando alguém compartilhar a tela, ela aparecerá aqui.</span>
      </div>
    );
  }

  return (
    <div className="crz-call-player-media">
      <video ref={videoRef} autoPlay playsInline muted />
      <audio ref={audioRef} autoPlay />
      <div className="crz-call-player-label">
        <span>{share.participantName}</span>
        <b>AO VIVO</b>
        <em>{share.audioTrack ? (muted ? "Áudio mutado" : "Áudio") : "Sem áudio da tela"}</em>
      </div>
    </div>
  );
}

export function ScreenSharePreview({
  share,
  active,
  onSelect,
}: {
  share: ActiveScreenShare;
  active: boolean;
  onSelect: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => attachTrack(share.videoTrack, videoRef.current), [share]);

  return (
    <button
      type="button"
      className={"crz-call-preview " + (active ? "is-active" : "")}
      onClick={onSelect}
    >
      <video ref={videoRef} autoPlay playsInline muted />
      <span>
        <strong>{share.participantName}</strong>
        <small>● AO VIVO</small>
      </span>
    </button>
  );
}

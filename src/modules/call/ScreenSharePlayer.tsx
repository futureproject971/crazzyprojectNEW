"use client";

import { useEffect, useRef } from "react";
import type { ActiveScreenShare } from "./media-types";
import {
  screenConnectionLabel,
  useScreenTrackQuality,
} from "./screen-share/useScreenTrackQuality";

function attachTrack(
  track: ActiveScreenShare["videoTrack"],
  element: HTMLVideoElement | null,
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
}: {
  share: ActiveScreenShare | null;
  muted: boolean;
  volume: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const stats = useScreenTrackQuality(
    share?.videoTrack,
    share?.connectionQuality,
  );

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

  if (!share) {
    return (
      <div className="crz-call-empty-player">
        <strong>Esperando uma transmissão</strong>
        <span>Quando alguém compartilhar a tela, ela aparecerá aqui.</span>
      </div>
    );
  }

  const resolution = stats.width && stats.height
    ? `${stats.width}×${stats.height}`
    : "MEDINDO";

  return (
    <div className="crz-call-player-media">
      <video ref={videoRef} autoPlay playsInline muted />
      <audio ref={audioRef} autoPlay />
      <div className="crz-call-player-label">
        <span>{share.participantName}</span>
        <b>● AO VIVO</b>
        <em>{resolution}</em>
        <em>{stats.fps ? stats.fps + " FPS" : "FPS ..."}</em>
        <em>{screenConnectionLabel(stats.connection)}</em>
        {share.audioTrack && <em>{muted ? "ÁUDIO MUTADO" : "ÁUDIO DA TELA"}</em>}
      </div>
      <details className="crz-call-quality-details">
        <summary>DIAGNÓSTICO</summary>
        <div>
          <span>BITRATE <b>{stats.bitrateKbps ? stats.bitrateKbps + " kbps" : "..."}</b></span>
          <span>RTT <b>{stats.rttMs ? stats.rttMs + " ms" : "..."}</b></span>
          <span>JITTER <b>{stats.jitterMs ? stats.jitterMs + " ms" : "..."}</b></span>
          <span>LOSS <b>{stats.packetsLost}</b></span>
          <span>NACK <b>{stats.nackCount}</b></span>
          <span>PLI <b>{stats.pliCount}</b></span>
          <span>CODEC <b>{stats.codec || "..."}</b></span>
          <span>LIMIT <b>{stats.qualityLimitationReason || "none"}</b></span>
        </div>
      </details>
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

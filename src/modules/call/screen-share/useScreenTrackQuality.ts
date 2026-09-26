"use client";

import { useEffect, useRef, useState } from "react";
import type { ConnectionQuality } from "livekit-client";
import type { CallVideoTrack } from "../media-types";

export type ScreenQualitySnapshot = {
  width: number;
  height: number;
  fps: number;
  bitrateKbps: number;
  packetsLost: number;
  jitterMs: number;
  rttMs: number;
  nackCount: number;
  pliCount: number;
  codec: string;
  qualityLimitationReason: string;
  connection: "excellent" | "good" | "unstable" | "unknown";
};

const EMPTY: ScreenQualitySnapshot = {
  width: 0,
  height: 0,
  fps: 0,
  bitrateKbps: 0,
  packetsLost: 0,
  jitterMs: 0,
  rttMs: 0,
  nackCount: 0,
  pliCount: 0,
  codec: "",
  qualityLimitationReason: "",
  connection: "unknown",
};

function connectionLabel(value?: ConnectionQuality | string) {
  if (value === "excellent") return "excellent" as const;
  if (value === "good") return "good" as const;
  if (value === "poor" || value === "lost") return "unstable" as const;
  return "unknown" as const;
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function useScreenTrackQuality(
  track: CallVideoTrack | null | undefined,
  participantQuality?: ConnectionQuality | string,
) {
  const [snapshot, setSnapshot] = useState<ScreenQualitySnapshot>(EMPTY);
  const previousRef = useRef<{ bytes: number; at: number } | null>(null);
  const historyRef = useRef<{ fps: number[]; bitrate: number[]; rtt: number[] }>({
    fps: [],
    bitrate: [],
    rtt: [],
  });

  useEffect(() => {
    previousRef.current = null;
    historyRef.current = { fps: [], bitrate: [], rtt: [] };
    setSnapshot({ ...EMPTY, connection: connectionLabel(participantQuality) });

    if (!track) return;

    let cancelled = false;

    const collect = async () => {
      try {
        const report = await track.getRTCStatsReport();
        if (cancelled) return;

        const settings = track.mediaStreamTrack.getSettings();
        let width = Number(settings.width || 0);
        let height = Number(settings.height || 0);
        let fps = Number(settings.frameRate || 0);
        let bytes = 0;
        let packetsLost = 0;
        let jitterMs = 0;
        let rttMs = 0;
        let nackCount = 0;
        let pliCount = 0;
        let codec = "";
        let qualityLimitationReason = "";

        if (report) {
          for (const raw of report.values()) {
            const stat = raw as any;
            const isVideoRtp =
              (stat.type === "inbound-rtp" || stat.type === "outbound-rtp") &&
              (stat.kind === "video" || stat.mediaType === "video");
            if (isVideoRtp) {
              width = Number(stat.frameWidth || width || 0);
              height = Number(stat.frameHeight || height || 0);
              fps = Number(stat.framesPerSecond || fps || 0);
              bytes = Number(stat.bytesSent ?? stat.bytesReceived ?? bytes ?? 0);
              packetsLost = Number(stat.packetsLost || 0);
              jitterMs = Math.max(jitterMs, Number(stat.jitter || 0) * 1000);
              nackCount = Number(stat.nackCount || 0);
              pliCount = Number(stat.pliCount || 0);
              qualityLimitationReason = String(stat.qualityLimitationReason || "");
              if (stat.codecId && report.get(stat.codecId)) {
                codec = String((report.get(stat.codecId) as any)?.mimeType || "")
                  .replace(/^video\//i, "")
                  .toUpperCase();
              }
            }

            if (stat.type === "remote-inbound-rtp" && (stat.kind === "video" || stat.mediaType === "video")) {
              rttMs = Math.max(rttMs, Number(stat.roundTripTime || 0) * 1000);
              packetsLost = Math.max(packetsLost, Number(stat.packetsLost || 0));
              jitterMs = Math.max(jitterMs, Number(stat.jitter || 0) * 1000);
            }

            if (stat.type === "candidate-pair" && stat.state === "succeeded") {
              rttMs = Math.max(rttMs, Number(stat.currentRoundTripTime || 0) * 1000);
            }
          }
        }

        const now = performance.now();
        let bitrateKbps = 0;
        if (bytes > 0 && previousRef.current && now > previousRef.current.at) {
          bitrateKbps =
            ((bytes - previousRef.current.bytes) * 8) /
            (now - previousRef.current.at);
        }
        if (bytes > 0) previousRef.current = { bytes, at: now };

        const history = historyRef.current;
        history.fps = [...history.fps, Math.max(0, fps)].slice(-4);
        history.bitrate = [...history.bitrate, Math.max(0, bitrateKbps)].slice(-4);
        history.rtt = [...history.rtt, Math.max(0, rttMs)].slice(-4);

        setSnapshot({
          width: Math.round(width),
          height: Math.round(height),
          fps: Math.round(average(history.fps)),
          bitrateKbps: Math.round(average(history.bitrate)),
          packetsLost: Math.max(0, Math.round(packetsLost)),
          jitterMs: Math.round(jitterMs),
          rttMs: Math.round(average(history.rtt)),
          nackCount: Math.max(0, Math.round(nackCount)),
          pliCount: Math.max(0, Math.round(pliCount)),
          codec,
          qualityLimitationReason,
          connection: connectionLabel(participantQuality),
        });
      } catch {
        if (!cancelled) {
          const settings = track.mediaStreamTrack.getSettings();
          setSnapshot((current) => ({
            ...current,
            width: Number(settings.width || current.width || 0),
            height: Number(settings.height || current.height || 0),
            fps: Math.round(Number(settings.frameRate || current.fps || 0)),
            connection: connectionLabel(participantQuality),
          }));
        }
      }
    };

    void collect();
    const timer = window.setInterval(() => void collect(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [participantQuality, track]);

  return snapshot;
}

export function screenConnectionLabel(value: ScreenQualitySnapshot["connection"]) {
  if (value === "excellent") return "EXCELENTE";
  if (value === "good") return "BOA";
  if (value === "unstable") return "INSTÁVEL";
  return "CONECTANDO";
}

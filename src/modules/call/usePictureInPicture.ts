"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveScreenShare } from "./media-types";

type PipDocument = Document & {
  pictureInPictureEnabled?: boolean;
  pictureInPictureElement?: Element | null;
  exitPictureInPicture?: () => Promise<void>;
};

type PipVideoElement = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<unknown>;
};

export function usePictureInPicture({
  shares,
  muted,
  volume,
  onStreamEnded,
}: {
  shares: ActiveScreenShare[];
  muted: boolean;
  volume: number;
  onStreamEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const endedCleanupRef = useRef<(() => void) | null>(null);
  const [supported, setSupported] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    const doc = document as PipDocument;
    const probe = document.createElement("video") as PipVideoElement;
    setSupported(Boolean(doc.pictureInPictureEnabled && probe.requestPictureInPicture));
  }, []);

  const cleanupEndedListener = useCallback(() => {
    endedCleanupRef.current?.();
    endedCleanupRef.current = null;
  }, []);

  const exit = useCallback(async () => {
    const doc = document as PipDocument;
    cleanupEndedListener();
    if (doc.pictureInPictureElement && doc.exitPictureInPicture) {
      await doc.exitPictureInPicture().catch(() => undefined);
    }
    setActiveKey(null);
  }, [cleanupEndedListener]);

  const enter = useCallback(async (share: ActiveScreenShare) => {
    const doc = document as PipDocument;
    const video = videoRef.current as PipVideoElement | null;
    if (!video || !supported || !video.requestPictureInPicture) return false;

    if (doc.pictureInPictureElement && doc.exitPictureInPicture) {
      await doc.exitPictureInPicture().catch(() => undefined);
    }

    cleanupEndedListener();

    const mediaTracks: MediaStreamTrack[] = [share.videoTrack.mediaStreamTrack];
    if (share.audioTrack && !share.audioTrack.isMuted) {
      mediaTracks.push(share.audioTrack.mediaStreamTrack);
    }

    video.srcObject = new MediaStream(mediaTracks);
    video.muted = muted;
    video.volume = Math.min(1, Math.max(0, volume));
    video.playsInline = true;

    const handleEnded = () => {
      void exit().finally(onStreamEnded);
    };
    share.videoTrack.mediaStreamTrack.addEventListener("ended", handleEnded, { once: true });
    endedCleanupRef.current = () =>
      share.videoTrack.mediaStreamTrack.removeEventListener("ended", handleEnded);

    await video.play();
    await video.requestPictureInPicture();
    setActiveKey(share.key);
    return true;
  }, [cleanupEndedListener, exit, muted, onStreamEnded, supported, volume]);

  const switchTo = useCallback(async (share: ActiveScreenShare) => {
    await exit();
    return enter(share);
  }, [enter, exit]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => undefined;
    const onLeave = () => {
      cleanupEndedListener();
      setActiveKey(null);
    };

    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
      cleanupEndedListener();
    };
  }, [cleanupEndedListener]);

  useEffect(() => {
    if (!activeKey) return;
    if (!shares.some((share) => share.key === activeKey)) {
      void exit().finally(onStreamEnded);
    }
  }, [activeKey, exit, onStreamEnded, shares]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = Math.min(1, Math.max(0, volume));
  }, [muted, volume]);

  return {
    videoRef,
    supported,
    activeKey,
    active: Boolean(activeKey),
    enter,
    exit,
    switchTo,
  };
}

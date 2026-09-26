import {
  ScreenSharePresets,
  Track,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
} from "livekit-client";

export type ScreenShareProfile = "auto" | "clarity" | "game";

export type ScreenProfileDefinition = {
  id: ScreenShareProfile;
  label: string;
  description: string;
  contentHint: "detail" | "motion";
  targetWidth: number;
  targetHeight: number;
  targetFps: number;
};

export const SCREEN_PROFILES: Record<ScreenShareProfile, ScreenProfileDefinition> = {
  auto: {
    id: "auto",
    label: "AUTO",
    description: "Equilibra estabilidade e definição automaticamente.",
    contentHint: "detail",
    targetWidth: 1920,
    targetHeight: 1080,
    targetFps: 30,
  },
  clarity: {
    id: "clarity",
    label: "NITIDEZ",
    description: "Prioriza texto, menus, navegador e desktop.",
    contentHint: "detail",
    targetWidth: 1920,
    targetHeight: 1080,
    targetFps: 30,
  },
  game: {
    id: "game",
    label: "GAME",
    description: "Prioriza movimento e tenta até 60 FPS reais.",
    contentHint: "motion",
    targetWidth: 1920,
    targetHeight: 1080,
    targetFps: 60,
  },
};

export function screenCaptureOptions(
  profile: ScreenShareProfile,
  withAudio: boolean,
): ScreenShareCaptureOptions {
  const definition = SCREEN_PROFILES[profile];

  return {
    audio: withAudio,
    contentHint: definition.contentHint,
    resolution: {
      width: definition.targetWidth,
      height: definition.targetHeight,
      frameRate: definition.targetFps,
    },
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    systemAudio: withAudio ? "include" : "exclude",
  };
}

export function screenPublishOptions(profile: ScreenShareProfile): TrackPublishOptions {
  if (profile === "game") {
    return {
      source: Track.Source.ScreenShare,
      simulcast: true,
      degradationPreference: "maintain-framerate",
      screenShareEncoding: {
        maxBitrate: 6_000_000,
        maxFramerate: 60,
      },
      screenShareSimulcastLayers: [
        ScreenSharePresets.h360fps15,
        ScreenSharePresets.h720fps30,
      ],
    };
  }

  if (profile === "clarity") {
    return {
      source: Track.Source.ScreenShare,
      simulcast: true,
      degradationPreference: "maintain-resolution",
      screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
      screenShareSimulcastLayers: [
        ScreenSharePresets.h360fps15,
        ScreenSharePresets.h720fps15,
      ],
    };
  }

  return {
    source: Track.Source.ScreenShare,
    simulcast: true,
    degradationPreference: "balanced",
    screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
    screenShareSimulcastLayers: [
      ScreenSharePresets.h360fps15,
      ScreenSharePresets.h720fps15,
    ],
  };
}

export function postCaptureConstraints(profile: ScreenShareProfile): MediaTrackConstraints {
  const definition = SCREEN_PROFILES[profile];
  return {
    width: { ideal: definition.targetWidth, max: definition.targetWidth },
    height: { ideal: definition.targetHeight, max: definition.targetHeight },
    frameRate: {
      ideal: definition.targetFps,
      max: definition.targetFps,
    },
  };
}

import type {
  ConnectionQuality,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteAudioTrack,
  RemoteTrackPublication,
  RemoteVideoTrack,
} from "livekit-client";

export type CallVideoTrack = LocalVideoTrack | RemoteVideoTrack;
export type CallAudioTrack = LocalAudioTrack | RemoteAudioTrack;

export type ActiveScreenShare = {
  key: string;
  participantIdentity: string;
  participantName: string;
  isLocal: boolean;
  videoTrack: CallVideoTrack;
  audioTrack?: CallAudioTrack;
  remotePublication?: RemoteTrackPublication;
  connectionQuality?: ConnectionQuality;
};

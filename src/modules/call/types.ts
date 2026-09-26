export type CallRoomStatus = "waiting" | "live" | "ended" | "disabled";
export type CallParticipantRole = "host" | "cohost" | "participant" | "viewer";
export type CallConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export type CallRoom = {
  id: string;
  code: string;
  owner_id: string;
  title: string | null;
  room_mode: "call" | "live";
  password_protected: boolean;
  status: CallRoomStatus;
  locked: boolean;
  max_participants: number;
  allow_guests: boolean;
  allow_screen_share: boolean;
  // Legacy DB fields kept for migration compatibility. CRAZZY CALL runtime is screen-only.
  allow_camera: boolean;
  allow_microphone: boolean;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
};

export type CallParticipant = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: CallParticipantRole;
  joined_at: string;
  left_at: string | null;
  kicked_at: string | null;
  is_connected: boolean;
  last_seen_at: string;
};

export type CallRoomPreview = {
  id: string;
  code: string;
  owner_id: string;
  title: string | null;
  room_mode: "call" | "live";
  password_protected: boolean;
  status: CallRoomStatus;
  locked: boolean;
  max_participants: number;
  participant_count: number;
  allow_screen_share: boolean;
  // Legacy compatibility only. Do not use to request camera/microphone.
  allow_camera: boolean;
  allow_microphone: boolean;
};

export type CallRoomSnapshot = {
  room: CallRoom;
  participants: CallParticipant[];
};

export type CallMessage = {
  id: string;
  room_id: string;
  user_id: string;
  message: string;
  created_at: string;
  deleted_at?: string | null;
};

export type CallStreamSelection = {
  participantIdentity: string;
  trackSid: string;
  participantName: string;
};

export type PictureInPictureState = {
  supported: boolean;
  active: boolean;
  selectedTrackSid: string | null;
};

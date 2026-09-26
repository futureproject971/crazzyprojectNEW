import { canPublishInCall } from "./permissions";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { TrackSource } from "@livekit/protocol";
import { getLiveKitServerConfig, liveKitRoomName } from "./config";
import type { CallParticipantRole, CallRoom } from "@/modules/call/types";

function requireConfig() {
  const config = getLiveKitServerConfig();
  if (!config.configured) {
    throw new Error("LIVEKIT_NOT_CONFIGURED");
  }
  return config;
}

export function isLiveKitConfigured() {
  return getLiveKitServerConfig().configured;
}

export async function ensureLiveKitRoom(room: CallRoom) {
  const config = requireConfig();
  const service = new RoomServiceClient(
    config.serverUrl,
    config.apiKey,
    config.apiSecret
  );
  const name = liveKitRoomName(room.id);
  const existing = await service.listRooms([name]);
  if (!existing.length) {
    await service.createRoom({
      name,
      maxParticipants: room.max_participants,
      emptyTimeout: 10 * 60,
      departureTimeout: 60,
      metadata: JSON.stringify({ callRoomId: room.id }),
    });
  }
  return { service, roomName: name, publicUrl: config.publicUrl };
}

export async function createLiveKitJoinToken(input: {
  room: CallRoom;
  userId: string;
  displayName: string;
  role: CallParticipantRole;
}) {
  const { room, userId, displayName, role } = input;
  const { roomName, publicUrl } = await ensureLiveKitRoom(room);
  const config = requireConfig();

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: userId,
    name: displayName,
    ttl: "15m",
    metadata: JSON.stringify({
      callRoomId: room.id,
      role,
    }),
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canSubscribe: true,
    canPublish: canPublishInCall(room.room_mode, role),
    canPublishSources: [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });

  return {
    token: await token.toJwt(),
    url: publicUrl,
    roomName,
  };
}

export async function removeLiveKitParticipant(roomId: string, userId: string) {
  const config = getLiveKitServerConfig();
  if (!config.configured) return;
  const service = new RoomServiceClient(config.serverUrl, config.apiKey, config.apiSecret);
  try {
    await service.removeParticipant(liveKitRoomName(roomId), userId);
  } catch {
    // DB remains authoritative for kick state even if the participant already disconnected.
  }
}

export async function updateLiveKitParticipantRole(
  roomId: string,
  userId: string,
  role: CallParticipantRole,
  mode: "call" | "live"
) {
  const config = getLiveKitServerConfig();
  if (!config.configured) return;
  const service = new RoomServiceClient(config.serverUrl, config.apiKey, config.apiSecret);
  try {
    await service.updateParticipant(liveKitRoomName(roomId), userId, {
      permission: {
        canSubscribe: true,
        canPublish: canPublishInCall(mode, role),
        canPublishSources: [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
    canPublishData: false,
      },
    });
  } catch {
    // Participant may be offline. Fresh tokens use the new DB role on reconnect.
  }
}

export async function endLiveKitRoom(roomId: string) {
  const config = getLiveKitServerConfig();
  if (!config.configured) return;
  const service = new RoomServiceClient(config.serverUrl, config.apiKey, config.apiSecret);
  try {
    await service.deleteRoom(liveKitRoomName(roomId));
  } catch {
    // The room may already be empty/deleted.
  }
}

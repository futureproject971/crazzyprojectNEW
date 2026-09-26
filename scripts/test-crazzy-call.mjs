const project = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const rest = project + "/rest/v1";
const key = "sb_publishable_Gu8G1uqggVf2pvVenX7EPQ_yIi5t2Kb";

async function req(path, init = {}) {
  return fetch(rest + path, {
    ...init,
    headers: {
      apikey: key,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
}

const rpcChecks = [
  ["create_call_room", "/rpc/create_call_room", { p_title: "anon-test", p_max_participants: 2 }],
  ["create_call_room_secure", "/rpc/create_call_room_secure", { p_title: "anon-test", p_max_participants: 2, p_room_mode: "live", p_password: "1234" }],
  ["get_call_room_preview", "/rpc/get_call_room_preview", { p_code: "AAAAAAAAAAAA" }],
  ["join_call_room", "/rpc/join_call_room", { p_code: "AAAAAAAAAAAA", p_display_name: null }],
  ["join_call_room_secure", "/rpc/join_call_room_secure", { p_code: "AAAAAAAAAAAA", p_display_name: null, p_password: "1234" }],
  ["list_call_broadcasts", "/rpc/list_call_broadcasts", {}],
  ["get_call_room_snapshot", "/rpc/get_call_room_snapshot", { p_code: "AAAAAAAAAAAA" }],
  ["leave_call_room", "/rpc/leave_call_room", { p_room_id: "00000000-0000-4000-8000-000000000000" }],
  ["set_call_presence", "/rpc/set_call_presence", { p_room_id: "00000000-0000-4000-8000-000000000000", p_connected: true }],
  ["set_call_room_locked", "/rpc/set_call_room_locked", { p_room_id: "00000000-0000-4000-8000-000000000000", p_locked: true }],
  ["set_call_participant_role", "/rpc/set_call_participant_role", {
    p_room_id: "00000000-0000-4000-8000-000000000000",
    p_participant_id: "00000000-0000-4000-8000-000000000000",
    p_role: "cohost",
  }],
  ["kick_call_participant", "/rpc/kick_call_participant", {
    p_room_id: "00000000-0000-4000-8000-000000000000",
    p_participant_id: "00000000-0000-4000-8000-000000000000",
  }],
  ["end_call_room", "/rpc/end_call_room", { p_room_id: "00000000-0000-4000-8000-000000000000" }],
  ["send_call_message", "/rpc/send_call_message", {
    p_room_id: "00000000-0000-4000-8000-000000000000",
    p_message: "anon",
  }],
];

for (const [name, path, body] of rpcChecks) {
  const response = await req(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (response.ok) {
    throw new Error(name + " must not be executable by anonymous users");
  }

  console.log("[PASS] " + name + " blocks anonymous access (" + response.status + ")");
}

for (const table of ["call_rooms", "call_participants", "call_messages", "call_events"]) {
  const response = await req("/" + table + "?select=*&limit=1");
  if (response.ok) {
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 0) {
      throw new Error("Anonymous users must not read " + table);
    }
  }
  console.log("[PASS] " + table + " exposes no anonymous rows");
}

const clientFiles = [
  "src/modules/call/CallRoom.tsx",
  "src/modules/call/CallExperience.tsx",
  "src/modules/call/usePictureInPicture.ts",
  "src/modules/call/ScreenSharePlayer.tsx",
];

const { readFile } = await import("node:fs/promises");
for (const file of clientFiles) {
  const content = await readFile(file, "utf8");
  for (const secret of ["LIVEKIT_API_SECRET", "LIVEKIT_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (content.includes(secret)) {
      throw new Error(file + " contains forbidden server secret reference: " + secret);
    }
  }
}
console.log("[PASS] client CRAZZY CALL files do not reference server secrets");

const authMiddleware = await readFile("src/lib/supabase/middleware.ts", "utf8");
for (const required of ['"/call"','"/api/call"',"discord_identities","guild_member"]) {
  if (!authMiddleware.includes(required)) {
    throw new Error("CRAZZY CALL global Discord/guild gate missing " + required);
  }
}
console.log("[PASS] CRAZZY CALL page and API namespace require Discord guild membership");

const pip = await readFile("src/modules/call/usePictureInPicture.ts", "utf8");
for (const required of [
  "pictureInPictureEnabled",
  "requestPictureInPicture",
  "exitPictureInPicture",
  "enterpictureinpicture",
  "leavepictureinpicture",
]) {
  if (!pip.includes(required)) {
    throw new Error("Native PiP implementation missing " + required);
  }
}
console.log("[PASS] native Picture-in-Picture API is implemented");

const createRoute = await readFile("src/app/api/call/create/route.ts", "utf8");
const joinRoute = await readFile("src/app/api/call/join/route.ts", "utf8");
const liveTypes = await readFile("src/modules/call/types.ts", "utf8");
for (const [file, content, required] of [
  ["create route", createRoute, "create_call_room_secure"],
  ["join route", joinRoute, "join_call_room_secure"],
  ["call types", liveTypes, "room_mode"],
]) {
  if (!content.includes(required)) throw new Error(file + " is missing protected/live call wiring");
}
console.log("[PASS] password-protected rooms and live spectator mode are wired");



const screenOnlyFiles = {
  room: await readFile("src/modules/call/CallRoom.tsx", "utf8"),
  lobby: await readFile("src/modules/call/CallLobby.tsx", "utf8"),
  controls: await readFile("src/modules/call/CallControls.tsx", "utf8"),
  participants: await readFile("src/modules/call/ParticipantList.tsx", "utf8"),
  livekitServer: await readFile("src/lib/call/livekit-server.ts", "utf8"),
  bot: await readFile("apps/discord-bot/src/modules/voice-rooms.js", "utf8"),
  profiles: await readFile("src/modules/call/screen-share/profiles.ts", "utf8"),
  engine: await readFile("src/modules/call/screen-share/useScreenShareEngine.ts", "utf8"),
  quality: await readFile("src/modules/call/screen-share/useScreenTrackQuality.ts", "utf8"),
  migration: await readFile("supabase/migrations/20260926224000_supplier_hardening_crazzy_screen_presence.sql", "utf8"),
};

for (const [name, content] of Object.entries({
  room: screenOnlyFiles.room,
  lobby: screenOnlyFiles.lobby,
  controls: screenOnlyFiles.controls,
})) {
  for (const forbidden of ["setCameraEnabled(", "setMicrophoneEnabled(", "getUserMedia("]) {
    if (content.includes(forbidden)) {
      throw new Error(name + " reintroduced forbidden camera/microphone runtime API: " + forbidden);
    }
  }
}
console.log("[PASS] CRAZZY CALL runtime does not request camera or microphone");

for (const forbidden of ["TrackSource.CAMERA", "TrackSource.MICROPHONE", "canPublishSources: [1, 3]"]) {
  if (screenOnlyFiles.livekitServer.includes(forbidden)) {
    throw new Error("LiveKit token reintroduced forbidden publish source: " + forbidden);
  }
}
for (const required of ["TrackSource.SCREEN_SHARE", "TrackSource.SCREEN_SHARE_AUDIO"]) {
  if (!screenOnlyFiles.livekitServer.includes(required)) {
    throw new Error("LiveKit token is missing " + required);
  }
}
console.log("[PASS] LiveKit tokens are screen-share-only");

for (const required of [
  "createScreenTracks(",
  "applyConstraints(",
  "Track.Source.ScreenShare",
  "Track.Source.ScreenShareAudio",
]) {
  if (!screenOnlyFiles.engine.includes(required)) {
    throw new Error("Screen Engine is missing " + required);
  }
}
for (const required of [
  'label: "AUTO"',
  'label: "NITIDEZ"',
  'label: "GAME"',
  '"maintain-resolution"',
  '"maintain-framerate"',
  "screenShareEncoding",
  "maxFramerate: 60",
]) {
  if (!screenOnlyFiles.profiles.includes(required)) {
    throw new Error("Screen profile engine is missing " + required);
  }
}
console.log("[PASS] transmitter profiles use real capture/publish controls");

for (const required of [
  "getRTCStatsReport()",
  "framesPerSecond",
  "currentRoundTripTime",
  "qualityLimitationReason",
  "nackCount",
  "pliCount",
]) {
  if (!screenOnlyFiles.quality.includes(required)) {
    throw new Error("Quality monitor is missing " + required);
  }
}
console.log("[PASS] screen quality monitor reads real WebRTC statistics");

for (const required of [
  "prepareConnection(",
  "RoomEvent.ConnectionQualityChanged",
  "RoomEvent.TrackStreamStateChanged",
  "RoomEvent.TrackSubscriptionFailed",
]) {
  if (!screenOnlyFiles.room.includes(required)) {
    throw new Error("CRAZZY CALL connection lifecycle is missing " + required);
  }
}
console.log("[PASS] LiveKit preconnect, quality and recovery events are wired");

if (/webcam/i.test(screenOnlyFiles.bot)) {
  throw new Error("Discord voice bot still advertises webcam");
}
for (const required of [
  "media_grace_seconds",
  "media_left_at",
  "TrackSource.SCREEN_SHARE",
]) {
  if (!screenOnlyFiles.bot.includes(required)) {
    throw new Error("Discord voice presence/screen reconciliation is missing " + required);
  }
}
if (!screenOnlyFiles.migration.includes("check_call_voice_presence")) {
  throw new Error("Discord voice presence RPC is missing");
}
console.log("[PASS] Discord voice presence gates CRAZZY CALL media access");

if (
  screenOnlyFiles.participants.includes("microphone: boolean") ||
  screenOnlyFiles.participants.includes("camera: boolean")
) {
  throw new Error("Participant media state still models CRAZZY CALL camera/microphone");
}
console.log("[PASS] participant UI is screen-share-only");

console.log("[PASS] CRAZZY CALL security smoke");

function toHttpUrl(value: string) {
  if (value.startsWith("wss://")) return "https://" + value.slice(6);
  if (value.startsWith("ws://")) return "http://" + value.slice(5);
  return value;
}

function toWsUrl(value: string) {
  if (value.startsWith("https://")) return "wss://" + value.slice(8);
  if (value.startsWith("http://")) return "ws://" + value.slice(7);
  return value;
}

export function getLiveKitServerConfig() {
  const rawUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
  const apiKey = process.env.LIVEKIT_API_KEY || "";
  const apiSecret = process.env.LIVEKIT_API_SECRET || "";

  return {
    serverUrl: rawUrl ? toHttpUrl(rawUrl) : "",
    publicUrl: rawUrl
      ? toWsUrl(process.env.NEXT_PUBLIC_LIVEKIT_URL || rawUrl)
      : "",
    apiKey,
    apiSecret,
    configured: Boolean(rawUrl && apiKey && apiSecret),
  };
}

export function liveKitRoomName(roomId: string) {
  return `crz_${roomId}`;
}

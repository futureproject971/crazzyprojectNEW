import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Track = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  source: "youtube";
};

function playlistIdOf(raw: string) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    return String(url.searchParams.get("list") || "").trim();
  } catch {
    return /^[A-Za-z0-9_-]{10,}$/.test(value) ? value : "";
  }
}

function textOf(value: any) {
  if (!value) return "";
  if (typeof value.simpleText === "string") return value.simpleText;
  if (Array.isArray(value.runs)) {
    return value.runs.map((item: any) => item?.text || "").join("");
  }
  return "";
}

function readBalancedJson(html: string, marker: string) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf("{", markerIndex + marker.length);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function collectPublicTracks(root: any, limit = 100) {
  const tracks: Track[] = [];
  const seen = new Set<string>();

  function append(renderer: any) {
    const id = String(renderer?.videoId || "").trim();
    if (!id || seen.has(id) || renderer?.isPlayable === false) return;
    seen.add(id);
    const thumbnails = renderer?.thumbnail?.thumbnails || [];
    const thumbnail =
      thumbnails[thumbnails.length - 1]?.url ||
      "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
    tracks.push({
      id,
      title: textOf(renderer?.title) || "Faixa do YouTube",
      channel:
        textOf(renderer?.shortBylineText) ||
        textOf(renderer?.longBylineText) ||
        "YouTube",
      thumbnail,
      source: "youtube",
    });
  }

  function walk(node: any) {
    if (!node || tracks.length >= limit) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
        if (tracks.length >= limit) break;
      }
      return;
    }
    if (typeof node !== "object") return;

    if (node.playlistVideoRenderer) append(node.playlistVideoRenderer);
    if (node.videoRenderer) append(node.videoRenderer);

    for (const value of Object.values(node)) {
      walk(value);
      if (tracks.length >= limit) break;
    }
  }

  walk(root);
  return tracks;
}

async function officialPlaylist(playlistId: string, key: string) {
  const tracks: Track[] = [];
  let pageToken = "";

  while (tracks.length < 100) {
    const params = new URLSearchParams({
      part: "snippet,contentDetails,status",
      maxResults: "50",
      playlistId,
      key,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/playlistItems?" + params.toString(),
      { cache: "no-store" }
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message || "YOUTUBE_API_ERROR");
    }

    for (const item of payload.items || []) {
      const id =
        item?.contentDetails?.videoId ||
        item?.snippet?.resourceId?.videoId;
      if (!id || item?.status?.privacyStatus === "private") continue;
      tracks.push({
        id,
        title: item?.snippet?.title || "Faixa do YouTube",
        channel:
          item?.snippet?.videoOwnerChannelTitle ||
          item?.snippet?.channelTitle ||
          "YouTube",
        thumbnail:
          item?.snippet?.thumbnails?.high?.url ||
          item?.snippet?.thumbnails?.medium?.url ||
          item?.snippet?.thumbnails?.default?.url ||
          "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
        source: "youtube",
      });
      if (tracks.length >= 100) break;
    }

    pageToken = String(payload.nextPageToken || "");
    if (!pageToken) break;
  }

  return tracks;
}

async function publicPlaylist(playlistId: string) {
  const response = await fetch(
    "https://www.youtube.com/playlist?list=" + encodeURIComponent(playlistId),
    {
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
      },
    }
  );
  if (!response.ok) throw new Error("YOUTUBE_PLAYLIST_UNAVAILABLE");
  const html = await response.text();
  const initial =
    readBalancedJson(html, "var ytInitialData =") ||
    readBalancedJson(html, "ytInitialData =") ||
    readBalancedJson(html, 'window["ytInitialData"] =');
  if (!initial) throw new Error("YOUTUBE_PLAYLIST_PARSE_FAILED");
  return collectPublicTracks(initial, 100);
}

export async function GET(request: NextRequest) {
  const playlistId = playlistIdOf(request.nextUrl.searchParams.get("url") || "");
  if (!playlistId) {
    return NextResponse.json(
      { error: "Cole um link válido de playlist do YouTube." },
      { status: 400 }
    );
  }

  const key = process.env.YOUTUBE_API_KEY?.trim();
  let tracks: Track[] = [];

  if (key) {
    try {
      tracks = await officialPlaylist(playlistId, key);
    } catch {
      // Public fallback below.
    }
  }

  if (!tracks.length) {
    try {
      tracks = await publicPlaylist(playlistId);
    } catch {
      // Error response below.
    }
  }

  if (!tracks.length) {
    return NextResponse.json(
      {
        error:
          "Não consegui ler essa playlist. Se ela for privada, vincule sua conta do YouTube.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { playlistId, tracks, source: key ? "youtube-api" : "youtube-public" },
    { headers: { "Cache-Control": "private, max-age=60" } }
  );
}

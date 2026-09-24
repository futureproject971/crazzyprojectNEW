import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { youtubeApi } from "@/lib/mtsounds/youtube";

type Track = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  source: "youtube";
};

async function playlistTracks(userId: string, playlistId: string) {
  const tracks: Track[] = [];
  let pageToken = "";

  while (tracks.length < 100) {
    const payload = await youtubeApi<any>(userId, "playlistItems", {
      part: "snippet,contentDetails,status",
      maxResults: "50",
      playlistId,
      ...(pageToken ? { pageToken } : {}),
    });

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

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  try {
    const playlistId = String(
      request.nextUrl.searchParams.get("playlistId") || ""
    ).trim();

    if (playlistId) {
      const tracks = await playlistTracks(user.id, playlistId);
      return NextResponse.json(
        { playlistId, tracks },
        { headers: { "Cache-Control": "private, max-age=60" } }
      );
    }

    const [channels, playlists] = await Promise.all([
      youtubeApi<any>(user.id, "channels", {
        part: "snippet,contentDetails",
        mine: "true",
        maxResults: "1",
      }),
      youtubeApi<any>(user.id, "playlists", {
        part: "snippet,contentDetails",
        mine: "true",
        maxResults: "25",
      }),
    ]);

    const channel = channels?.items?.[0] || null;
    const likesId =
      channel?.contentDetails?.relatedPlaylists?.likes || null;

    const normalized = (playlists?.items || []).map((item: any) => ({
      id: item.id,
      title: item?.snippet?.title || "Playlist",
      thumbnail:
        item?.snippet?.thumbnails?.medium?.url ||
        item?.snippet?.thumbnails?.default?.url ||
        null,
      itemCount: Number(item?.contentDetails?.itemCount || 0),
    }));

    return NextResponse.json(
      {
        account: {
          channelId: channel?.id || null,
          channelTitle: channel?.snippet?.title || null,
        },
        likesPlaylistId: likesId,
        playlists: normalized,
      },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "YOUTUBE_LIBRARY_FAILED",
      },
      { status: 503 }
    );
  }
}

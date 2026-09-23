import { NextResponse } from "next/server";
import { getMtSoundsRuntimeConfig, probeMtSounds } from "@/lib/mtsounds/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getMtSoundsRuntimeConfig();
  const health = await probeMtSounds(config.url);

  return NextResponse.json(
    {
      mode: config.mode,
      url: config.url,
      source: config.source,
      health,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
    }
  );
}

const DEFAULT_MT_SOUNDS_URL = "https://mtsounds.vercel.app/";

export type MtSoundsMode = "embed" | "external";

export type MtSoundsRuntimeConfig = {
  mode: MtSoundsMode;
  url: string;
  source: "environment" | "default";
};

function safePartnerUrl(raw: string | undefined) {
  const candidate = String(raw || "").trim() || DEFAULT_MT_SOUNDS_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return DEFAULT_MT_SOUNDS_URL;
    return url.toString();
  } catch {
    return DEFAULT_MT_SOUNDS_URL;
  }
}

export function getMtSoundsRuntimeConfig(): MtSoundsRuntimeConfig {
  const rawMode = String(process.env.MTSOUNDS_MODE || "embed").trim().toLowerCase();
  const url = safePartnerUrl(process.env.MTSOUNDS_URL);

  return {
    mode: rawMode === "external" ? "external" : "embed",
    url,
    source: process.env.MTSOUNDS_URL?.trim() ? "environment" : "default",
  };
}

export async function probeMtSounds(url: string) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: { "User-Agent": "CRAZZY-PROJECT-M46/1.0" },
    });

    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "User-Agent": "CRAZZY-PROJECT-M46/1.0",
          Range: "bytes=0-0",
        },
      });
    }

    return {
      reachable: response.ok || (response.status >= 300 && response.status < 400),
      status: response.status,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      reachable: false,
      status: null,
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

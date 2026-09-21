import { getVerifiedAccessToken } from "@/lib/supabase/server";

const DEFAULT_SUPABASE_URL = "https://nnmglkdpmffmaiuwbcct.supabase.co";

export function communityEdgeUrl(
  action: string,
  params?: Record<string, string | null | undefined>
) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const url = new URL("/functions/v1/community", base);
  url.searchParams.set("action", action);

  for (const [key, value] of Object.entries(params || {})) {
    if (value) url.searchParams.set(key, value);
  }

  return url;
}

export async function communityAuthHeader() {
  const token = await getVerifiedAccessToken();
  return token ? "Bearer " + token : "";
}

export async function proxyCommunityJson(response: Response) {
  const body = await response
    .json()
    .catch(() => ({ error: "Resposta inválida da Community." }));

  return { body, status: response.status };
}

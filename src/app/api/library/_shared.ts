import { getVerifiedAccessToken } from "@/lib/supabase/server";

const DEFAULT_SUPABASE_URL = "https://nnmglkdpmffmaiuwbcct.supabase.co";

export function libraryEdgeUrl(action: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const url = new URL("/functions/v1/library", base);
  url.searchParams.set("action", action);
  return url;
}

export async function libraryAuthHeader() {
  const token = await getVerifiedAccessToken();
  return token ? "Bearer " + token : "";
}

export async function proxyLibraryJson(response: Response) {
  const body = await response.json().catch(() => ({ error: "Resposta inválida da Library." }));
  return { body, status: response.status };
}

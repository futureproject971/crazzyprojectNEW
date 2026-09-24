import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

const protectedPrefixes = [
  "/checkout",
  "/biblioteca",
  "/painel",
  "/cliente",
  "/perfil",
  "/tickets",
  "/chat",
  "/comunidade",
  "/call",
  "/admin",
  "/parceiro",
];

const protectedApiPrefixes = [
  "/api/admin",
  "/api/call",
  "/api/community",
  "/api/checkout",
  "/api/client-hub",
  "/api/library",
  "/api/notifications",
  "/api/partner",
  "/api/profile",
  "/api/reseller",
  "/api/reviews/eligible",
  "/api/support",
  "/api/academy/progress",
];

function isConditionallyProtectedApi(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const action = request.nextUrl.searchParams.get("action") || "";

  if (pathname === "/api/luck") {
    return request.method !== "GET" || action === "history";
  }

  if (pathname === "/api/rewards") {
    return action !== "catalog";
  }

  if (pathname === "/api/reviews") {
    return request.method !== "GET";
  }

  return false;
}

function matchesPrefix(pathname:string,prefixes:string[]){
  return prefixes.some(prefix=>pathname===prefix||pathname.startsWith(prefix+"/"));
}

function loginRedirect(request:NextRequest){
  const loginUrl=request.nextUrl.clone();
  loginUrl.pathname="/login";
  loginUrl.search="";
  loginUrl.searchParams.set("next",request.nextUrl.pathname+request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

function guildRedirect(request:NextRequest){
  const url=request.nextUrl.clone();
  url.pathname="/entrar/servidor";
  url.search="";
  url.searchParams.set("next",request.nextUrl.pathname+request.nextUrl.search);
  return NextResponse.redirect(url);
}

export async function updateAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const pathname=request.nextUrl.pathname;
  const pageProtected=matchesPrefix(pathname,protectedPrefixes);
  const apiProtected=matchesPrefix(pathname,protectedApiPrefixes)||isConditionallyProtectedApi(request);
  if(!pageProtected&&!apiProtected)return response;

  const { data, error } = await supabase.auth.getClaims();
  const userId=!error&&data?.claims?.sub?String(data.claims.sub):null;

  if(!userId){
    if(apiProtected)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
    return loginRedirect(request);
  }

  const {data:discord,error:discordError}=await supabase
    .from("discord_identities")
    .select("discord_user_id,guild_member,guild_id")
    .eq("user_id",userId)
    .maybeSingle();

  const guildVerified=!discordError&&Boolean(discord?.discord_user_id)&&discord?.guild_member===true;

  if(!guildVerified){
    if(apiProtected)return NextResponse.json({error:"DISCORD_GUILD_REQUIRED"},{status:403});
    return guildRedirect(request);
  }

  return response;
}

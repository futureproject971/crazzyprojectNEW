import { NextRequest, NextResponse } from "next/server";

function isYouTubeUrl(value:string){
  try{
    const u=new URL(value);
    return u.protocol==="https:" && (u.hostname==="youtu.be" || u.hostname==="youtube.com" || u.hostname.endsWith(".youtube.com"));
  }catch{return false;}
}

export async function GET(req:NextRequest){
  const url=req.nextUrl.searchParams.get("url")?.trim();
  if(!url || !isYouTubeUrl(url))return NextResponse.json({error:"Link do YouTube inválido."},{status:400});

  // Pode ser trocado depois pelo downloader que você preferir.
  // Se o serviço aceitar URL por query, use {url} no template.
  const template=(process.env.DOWNLOADER_URL_TEMPLATE||"https://cobalt.tools/").trim();

  let destination=template.includes("{url}")
    ? template.replace("{url}",encodeURIComponent(url))
    : template;

  try{
    const parsed=new URL(destination);
    if(parsed.protocol!=="https:")throw new Error("invalid");
  }catch{
    return NextResponse.json({error:"O endereço do downloader configurado é inválido."},{status:500});
  }

  return NextResponse.redirect(destination,302);
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Result={id:string;title:string;channel:string;thumbnail:string;publishedAt?:string};

function textOf(value:any){
  if(!value)return "";
  if(typeof value.simpleText==="string")return value.simpleText;
  if(Array.isArray(value.runs))return value.runs.map((r:any)=>r?.text||"").join("");
  return "";
}

function readBalancedJson(html:string,marker:string){
  const markerIndex=html.indexOf(marker);
  if(markerIndex<0)return null;
  const start=html.indexOf("{",markerIndex+marker.length);
  if(start<0)return null;

  let depth=0,inString=false,escaped=false;
  for(let i=start;i<html.length;i++){
    const ch=html[i];
    if(inString){
      if(escaped){escaped=false;continue;}
      if(ch==="\\"){escaped=true;continue;}
      if(ch==='"')inString=false;
      continue;
    }
    if(ch==='"'){inString=true;continue;}
    if(ch==="{")depth++;
    if(ch==="}"){
      depth--;
      if(depth===0){
        try{return JSON.parse(html.slice(start,i+1));}catch{return null;}
      }
    }
  }
  return null;
}

function collectVideos(root:any,limit=8){
  const out:Result[]=[];
  const seen=new Set<string>();

  function walk(node:any){
    if(!node||out.length>=limit)return;
    if(Array.isArray(node)){for(const item of node){walk(item);if(out.length>=limit)break;}return;}
    if(typeof node!=="object")return;

    const vr=node.videoRenderer;
    if(vr?.videoId&&!seen.has(vr.videoId)){
      seen.add(vr.videoId);
      const thumbs=vr.thumbnail?.thumbnails||[];
      const thumb=thumbs[thumbs.length-1]?.url||`https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;
      out.push({
        id:vr.videoId,
        title:textOf(vr.title)||"Vídeo do YouTube",
        channel:textOf(vr.ownerText)||textOf(vr.shortBylineText)||"YouTube",
        thumbnail:thumb
      });
      if(out.length>=limit)return;
    }

    for(const value of Object.values(node)){walk(value);if(out.length>=limit)break;}
  }

  walk(root);
  return out;
}

async function officialSearch(q:string,key:string){
  const params=new URLSearchParams({
    part:"snippet",type:"video",maxResults:"8",q,safeSearch:"moderate",
    videoEmbeddable:"true",relevanceLanguage:"pt",key
  });
  const r=await fetch("https://www.googleapis.com/youtube/v3/search?"+params.toString(),{cache:"no-store"});
  const data=await r.json();
  if(!r.ok)throw new Error(data?.error?.message||"YouTube API error");

  return (data.items||[]).map((item:any)=>({
    id:item.id?.videoId,
    title:item.snippet?.title,
    channel:item.snippet?.channelTitle,
    thumbnail:item.snippet?.thumbnails?.high?.url||item.snippet?.thumbnails?.medium?.url||item.snippet?.thumbnails?.default?.url,
    publishedAt:item.snippet?.publishedAt
  })).filter((item:Result)=>item.id);
}

async function publicSearch(q:string){
  const url="https://www.youtube.com/results?search_query="+encodeURIComponent(q);
  const r=await fetch(url,{
    cache:"no-store",
    headers:{
      "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      "accept-language":"pt-BR,pt;q=0.9,en;q=0.7"
    }
  });
  if(!r.ok)throw new Error("YouTube search unavailable");
  const html=await r.text();

  const initial=
    readBalancedJson(html,"var ytInitialData =")||
    readBalancedJson(html,"ytInitialData =")||
    readBalancedJson(html,"window[\"ytInitialData\"] =");

  if(!initial)throw new Error("YouTube results could not be parsed");
  return collectVideos(initial,8);
}

export async function GET(req:NextRequest){
  const q=req.nextUrl.searchParams.get("q")?.trim();
  if(!q)return NextResponse.json({error:"Digite uma música para pesquisar."},{status:400});

  const key=process.env.YOUTUBE_API_KEY?.trim();
  let results:Result[]=[];

  if(key){
    try{results=await officialSearch(q,key);}catch{}
  }

  if(!results.length){
    try{results=await publicSearch(q);}catch{}
  }

  if(!results.length){
    return NextResponse.json({
      error:"O YouTube não liberou resultados agora.",
      results:[],
      externalSearchUrl:"https://www.youtube.com/results?search_query="+encodeURIComponent(q)
    },{status:503});
  }

  return NextResponse.json({results,source:key?"youtube-api":"youtube-public"});
}

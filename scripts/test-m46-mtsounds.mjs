const { readFile } = await import("node:fs/promises");
const page = await readFile("src/modules/mtsounds/MtSoundsPage.tsx", "utf8");
const editor = await readFile("src/modules/mtsounds/native/Editor.tsx", "utf8");
const search = await readFile("src/modules/mtsounds/native/MusicSearch.tsx", "utf8");
const youtube = await readFile("src/app/api/mtsounds/native/youtube/search/route.ts", "utf8");
const downloader = await readFile("src/app/api/mtsounds/native/downloader/route.ts", "utf8");
for (const required of ["./native/MusicSearch","./native/ReactiveVinyl","/mtsounds/editor","MTSOUND"]) if(!page.includes(required)) throw new Error("M46 native home missing "+required);
if(page.includes("<iframe")||page.includes("mtsounds.vercel.app")) throw new Error("M46 main experience must no longer depend on external app iframe");
for (const required of ["OfflineAudioContext","INTRO_MP3_BASE64","exportFinal","Bass Boost","Grave Estourado"]) if(!editor.includes(required)) throw new Error("M46 native editor missing "+required);
for (const required of ["/api/mtsounds/native/youtube/search","ReactiveVinyl","https://y2meta.is/pt93/youtube-to-mp3/"]) if(!search.includes(required)) throw new Error("M46 native search missing "+required);
if(!youtube.includes("youtube.com/results")||!downloader.includes("isYouTubeUrl")) throw new Error("M46 native backend routes are incomplete");
const vinyl = await readFile("src/modules/mtsounds/native/ReactiveVinyl.tsx", "utf8");
for (const required of ["/mtsounds/assets/mtsounds-vinyl-full.webp","vinyl-fallback","onError","vinyl-disc-shell"]) {
  if (!vinyl.includes(required)) throw new Error("M46 vinyl hardening missing " + required);
}
if (vinyl.includes("raw.githubusercontent.com")) throw new Error("M46 vinyl must not hotlink GitHub assets");

const background = await readFile("src/modules/mtsounds/native/ReactiveBackground.tsx", "utf8");
if (!background.includes("requestAnimationFrame") || !background.includes("mts-reactive-bg")) {
  throw new Error("M46 reactive visual background missing");
}

const styles = await readFile("src/modules/mtsounds/styles.css", "utf8");
for (const required of ["mts-site-art-bg","mts-inner-nav","vinyl-disc-shell","vinyl-fallback"]) {
  if (!styles.includes(required)) throw new Error("M46 premium visual fidelity missing " + required);
}

const layout = await readFile("src/app/layout.tsx", "utf8");
const globalPlayer = await readFile("src/core/music/GlobalMusicProvider.tsx", "utf8");
const globalPlayerStyles = await readFile("src/core/music/styles.css", "utf8");

for (const required of ["GlobalMusicProvider","@/core/music/styles.css"]) {
  if (!layout.includes(required)) throw new Error("M46 global music root integration missing " + required);
}
for (const required of [
  "crz:mtsounds:queue:v1",
  "crz:mtsounds:playlist:v1",
  "localStorage",
  "playNow",
  "enqueue",
  "playPlaylist",
  "if(data.info===0)next()",
  "picture-in-picture",
  "• PIP",
  "crz:mtsounds:position:v1",
  "getCurrentTime",
  "seekTo",
]) {
  if (!globalPlayer.includes(required)) throw new Error("M46 persistent music player missing " + required);
}
for (const required of ["position:fixed","crz-global-music__drawer","crz-global-music__video"]) {
  if (!globalPlayerStyles.includes(required)) throw new Error("M46 site PiP styling missing " + required);
}
for (const required of ["music.youtube.com","youtube-music","Tocar no site","globalPlayer.enqueue","globalPlayer.addToPlaylist","https://y2meta.is/pt93/youtube-to-mp3/"]) {
  if (!search.includes(required)) throw new Error("M46 YouTube/queue integration missing " + required);
}
for (const forbidden of ["Play faz girar","Pause segura o ângulo","REAGE AO PLAYER","O SOM BATE.","O VINIL RESPONDE."]) {
  if (page.includes(forbidden)) throw new Error("M46 literal/technical marketing copy returned: " + forbidden);
}

const bridge = await readFile("src/core/navigation/InternalNavigationBridge.tsx", "utf8");
if (!bridge.includes("router.push") || !bridge.includes("a[href]")) throw new Error("M46 global route persistence bridge missing");
console.log("[PASS] M46 MTSOUNDS is native, route-persistent, position-restoring and Y2Meta-linked");

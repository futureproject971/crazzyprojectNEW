const { readFile } = await import("node:fs/promises");
const page = await readFile("src/modules/mtsounds/MtSoundsPage.tsx", "utf8");
const editor = await readFile("src/modules/mtsounds/native/Editor.tsx", "utf8");
const search = await readFile("src/modules/mtsounds/native/MusicSearch.tsx", "utf8");
const youtube = await readFile("src/app/api/mtsounds/native/youtube/search/route.ts", "utf8");
const downloader = await readFile("src/app/api/mtsounds/native/downloader/route.ts", "utf8");
for (const required of ["./native/MusicSearch","./native/ReactiveVinyl","/mtsounds/editor","MTSOUND"]) if(!page.includes(required)) throw new Error("M46 native home missing "+required);
if(page.includes("<iframe")||page.includes("mtsounds.vercel.app")) throw new Error("M46 main experience must no longer depend on external app iframe");
for (const required of ["OfflineAudioContext","INTRO_MP3_BASE64","exportFinal","Bass Boost","Grave Estourado"]) if(!editor.includes(required)) throw new Error("M46 native editor missing "+required);
for (const required of ["/api/mtsounds/native/youtube/search","/api/mtsounds/native/downloader","ReactiveVinyl"]) if(!search.includes(required)) throw new Error("M46 native search missing "+required);
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

console.log("[PASS] M46 MTSOUNDS source is native, local-asset backed and visually hardened");

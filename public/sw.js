const CACHE="crazzy-shell-v1";
const STATIC=["/offline","/brand/crazzy-logo-hero.png","/brand/crazzy-logo-navbar.png"];

self.addEventListener("install",(event)=>{
  event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(STATIC)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",(event)=>{
  event.waitUntil(
    caches.keys()
      .then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE).map((key)=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",(event)=>{
  const request=event.request;
  if(request.method!=="GET")return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith("/api/")||url.pathname.startsWith("/auth/")||url.pathname.startsWith("/login"))return;

  if(request.mode==="navigate"){
    event.respondWith(
      fetch(request)
        .then((response)=>response)
        .catch(()=>caches.match("/offline"))
    );
    return;
  }

  if(
    url.pathname.startsWith("/_next/static/")||
    url.pathname.startsWith("/icons/")||
    url.pathname.startsWith("/brand/")
  ){
    event.respondWith(
      caches.match(request).then((cached)=>cached||fetch(request).then((response)=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then((cache)=>cache.put(request,copy));
        }
        return response;
      }))
    );
  }
});

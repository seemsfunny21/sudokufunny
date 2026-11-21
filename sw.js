/* SudokuFunny isolated cache; other applications on this GitHub Pages origin are untouched. */
const PREFIX="sudokufunny-shell-";
const CACHE=PREFIX+"v11-banner-alignment";
const FILES=["./","./index.html","./style.css?v=10","./sudoku-engine.js?v=1",
 "./app.js?v=8","./hero-banner.svg","./icon.svg","./manifest.webmanifest"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
self.addEventListener("fetch",event=>{
 const req=event.request,url=new URL(req.url),scope=new URL(self.registration.scope);
 if(req.method!=="GET"||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(req.mode==="navigate"){
   try{
    const response=await fetch(req,{cache:"no-store"});
    if(response.ok)try{await cache.put("./index.html",response.clone())}catch(_){}
    return response;
   }catch{return await cache.match("./index.html")||Response.error()}
  }
  const cached=await cache.match(req);
  if(cached)return cached;
  try{
   const response=await fetch(req);
   if(response.ok)try{await cache.put(req,response.clone())}catch(_){}
   return response;
  }catch{return Response.error()}
 })());
});

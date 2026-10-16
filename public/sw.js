const CACHE = 'locke-static-v2';
const STATIC = ['/manifest.webmanifest', '/favicon.svg', '/offline.html'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('legal-eye-shell-') || (key.startsWith('locke-static-') && key !== CACHE)).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  // Auth, legal work, RSC and API responses never enter an offline cache.
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('/offline.html').then(response=>response||new Response('Reconnect to continue.',{status:503,headers:{'content-type':'text/plain'}}))));
    return;
  }
  if(!STATIC.includes(url.pathname)||url.search)return;
  event.respondWith(fetch(request).then(response=>{if(response.ok)void caches.open(CACHE).then(cache=>cache.put(request,response.clone())).catch(()=>undefined);return response;}).catch(()=>caches.match(request).then(response=>response||new Response('',{status:503}))));
});

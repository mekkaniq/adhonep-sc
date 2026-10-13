/* ADHONEP-SC · service worker (claude v1.6). Só guarda o "casco" do site; dados do Supabase nunca ficam em cache aqui. */
const V='adh-shell-v3.0';
const SHELL=['./','index.html','assets/mapa-terreno.jpg','assets/mapa-mar.jpg','styles.css','js/app.js','js/mapa.js','js/supabase.js','manifest.webmanifest','assets/logo-branca.png','assets/icon-192.png','assets/apple-touch-icon-2.png','assets/fundo-hero.jpg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==location.origin)return;           // Supabase e outros domínios: direto na rede
 e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));
});

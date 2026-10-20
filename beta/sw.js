/* ADHONEP-SC · service worker (claude v1.9). Só guarda o "casco" do site; dados do Supabase nunca ficam em cache aqui. */
const BETA=/\/beta\/$/.test(self.registration.scope);   // site rodando na pasta /beta tem cache separado
const V='adh-shell-v1.9'+(BETA?'-beta':'');
const SHELL=['./','index.html','assets/mapa-terreno.jpg','assets/mapa-mar.jpg','styles.css','js/app.js?v=1.9','js/mapa.js?v=1.9','js/supabase.js?v=1.9','js/gestao.js?v=1.9','js/roteiro.js?v=1.9','js/central.js?v=1.9','manifest.webmanifest','assets/adhonep.ico','assets/logo-branca.png','assets/icon-192.png','assets/app-icon-180.png','assets/fundo-hero.jpg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k.indexOf('adh-shell-')===0&&k.endsWith('-beta')===BETA).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==location.origin)return;           // Supabase e outros domínios: direto na rede
 e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):Response.error()))));
});

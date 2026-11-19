/* ADHONEP-SC · service worker (claude v1.17.2). Guarda no aparelho o que não muda a cada visita, para quem volta todo dia
   não baixar tudo de novo. Dados do Supabase NUNCA passam por aqui (outro domínio; o cache de dados fica em supabase.js).
   - Página (HTML): busca a nova primeiro (para receber atualizações); sem internet ou demorando mais de 4 s, usa a guardada.
   - Arquivos com versão (?v=…), imagens, dados fixos (mapa, municípios), ícones e fontes: usa o guardado na hora e atualiza por trás.
   - Fotos dos convites e dos capítulos (pasta pública do Supabase): guardadas na 1ª vez e usadas do aparelho depois
     (cada foto enviada tem endereço próprio, então não fica velha). Até 200 fotos; as mais antigas saem.
   - Vídeos: na 1ª vez tocam direto da internet e são guardados inteiros por trás; depois tocam do aparelho (com avanço/retrocesso). */
const BETA = /\/beta\/$/.test(self.registration.scope);   // site rodando na pasta /beta tem cache separado
const SUF = BETA ? '-beta' : '';
const V = 'adh-shell-v1.18.5' + SUF;          // página e arquivos com versão
const MEDIA = 'adh-media-v1' + SUF;           // imagens, dados fixos e vídeos (sobrevive às atualizações do site)
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'assets/adhonep.ico', 'assets/logo-branca.png', 'assets/icon-192.png', 'assets/fundo-hero.jpg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k !== MEDIA && /^adh-(shell|media)-/.test(k) && k.endsWith('-beta') === BETA).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function guarda(nome, req, res) { if (res && res.ok && res.status === 200) { const cp = res.clone(); caches.open(nome).then((c) => c.put(req, cp)).catch(() => {}); } return res; }

/* página: rede primeiro, com limite de tempo */
function pagina(req) {
  const rede = fetch(req).then((res) => guarda(V, req, res));
  const espera = new Promise((ok) => setTimeout(ok, 4000)).then(() => caches.match(req).then((m) => m || caches.match('index.html')).then((m) => m || rede));
  return Promise.race([rede.catch(() => caches.match(req).then((m) => m || caches.match('index.html')).then((m) => m || Response.error())), espera]);
}

/* arquivo com ?v=: usa o guardado na hora e confere a rede por trás (se alguém esquecer de trocar a versão, corrige
   sozinho na visita seguinte); ao guardar, apaga as outras versões do mesmo arquivo */
function versionado(req, u) {
  return caches.open(V).then((c) => c.match(req).then((m) => {
    const rede = fetch(req).then((res) => {
      if (res.ok && res.status === 200) {
        c.put(req, res.clone());
        c.keys().then((ks) => ks.forEach((k) => { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) c.delete(k); }));
      }
      return res;
    }).catch(() => m || Response.error());
    return m || rede;
  }));
}

/* imagens e dados fixos: usa o guardado e atualiza por trás */
function guardadoEAtualiza(req) {
  return caches.open(MEDIA).then((c) => c.match(req).then((m) => {
    const rede = fetch(req).then((res) => guarda(MEDIA, req, res)).catch(() => m || Response.error());
    return m || rede;
  }));
}

/* vídeo: responde pedidos parciais (Range) a partir do arquivo inteiro guardado */
const baixando = new Set();
function video(e, req, u) {
  const chave = u.origin + u.pathname;
  return caches.open(MEDIA).then((c) => c.match(chave).then(async (m) => {
    if (!m) {
      if (!baixando.has(chave)) {   // guarda o arquivo inteiro por trás, uma vez só
        baixando.add(chave);
        e.waitUntil(fetch(chave).then((res) => { if (res.ok && res.status === 200) return c.put(chave, res); }).catch(() => {}).finally(() => baixando.delete(chave)));
      }
      return fetch(req);
    }
    const range = req.headers.get('range');
    if (!range) return m;
    const buf = await m.arrayBuffer(), tam = buf.byteLength;
    const r = /bytes=(\d*)-(\d*)/.exec(range) || [];
    let ini = r[1] === '' || r[1] == null ? null : Number(r[1]), fim = r[2] === '' || r[2] == null ? null : Number(r[2]);
    if (ini == null) { ini = Math.max(0, tam - (fim || 0)); fim = tam - 1; } else if (fim == null || fim >= tam) fim = tam - 1;
    if (ini >= tam || ini > fim) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + tam } });
    return new Response(buf.slice(ini, fim + 1), { status: 206, headers: {
      'Content-Type': m.headers.get('Content-Type') || 'video/mp4', 'Content-Range': 'bytes ' + ini + '-' + fim + '/' + tam,
      'Content-Length': String(fim - ini + 1), 'Accept-Ranges': 'bytes' } });
  })).catch(() => fetch(req));
}

/* fotos públicas (convites e capítulos): guardadas no aparelho; pedidas com CORS para a resposta poder ser guardada */
const FOTOS = /^https:\/\/ayrdfetnscrfrlcssiua\.supabase\.co\/storage\/v1\/object\/public\/(adhonep-event-invitations|chapter-photos)\//;
function foto(req) {
  return caches.open(MEDIA).then((c) => c.match(req.url).then((m) => m || fetch(req.url, { mode: 'cors', credentials: 'omit' }).then((res) => {
    if (res.ok && res.status === 200) {
      c.put(req.url, res.clone()).then(() => c.keys()).then((ks) => {
        const f = ks.filter((k) => FOTOS.test(k.url));
        if (f.length > 200) f.slice(0, f.length - 200).forEach((k) => c.delete(k));
      }).catch(() => {});
    }
    return res;
  }).catch(() => fetch(req))));
}

self.addEventListener('fetch', (e) => {
  const req = e.request, u = new URL(req.url);
  if (req.method === 'GET' && FOTOS.test(req.url)) { e.respondWith(foto(req)); return; }
  if (req.method !== 'GET' || u.origin !== location.origin) return;   // dados do Supabase e outros domínios: direto na rede
  if (/\.(mp4|webm|m4a)$/i.test(u.pathname)) { e.respondWith(video(e, req, u)); return; }
  if (req.mode === 'navigate' || /\/(index\.html)?$/.test(u.pathname)) { e.respondWith(pagina(req)); return; }
  if (u.searchParams.has('v')) { e.respondWith(versionado(req, u)); return; }
  if (/\.(png|jpe?g|webp|gif|svg|ico|json|woff2?|webmanifest)$/i.test(u.pathname)) { e.respondWith(guardadoEAtualiza(req)); return; }
  e.respondWith(fetch(req).then((res) => guarda(V, req, res)).catch(() => caches.match(req).then((m) => m || Response.error())));
});

/* ADHONEP-SC — mapa.js (claude v1.5)
   Mapa de Santa Catarina para o site público e para o painel administrativo.
   - Geometria simplificada e suavizada uma única vez e guardada em cache (IndexedDB, 30 dias).
   - Navegação em 3 níveis: estado → região (isola) → município (isola). Clicar fora volta um nível.
   - Público: destaque dourado nos municípios com capítulo ativo e publicado; busca por cidade sem
     capítulo mostra os 2 capítulos mais próximos.
   - Administrativo: 4 situações (ativo, em ativação, em reativação, inativo), cada uma com sua cor.
   Os dados (capítulos, regiões, vínculos, limites) vêm sempre do Supabase. */
(function (root) {
  'use strict';

  /* ===================== utilitários puros (testáveis em Node) ===================== */
  var SCALE = 180;                         // unidades de desenho por grau
  var KM_PER_UNIT = 111.32 / SCALE;        // 1 unidade ≈ 0,62 km
  var CACHE_V = 3, CACHE_TTL = 30 * 24 * 3600 * 1000;
  var EPS_COARSE = 0.30, EPS_FINE = 0.05;  // tolerâncias de simplificação (unidades)

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function mix(hex, amount) {
    var n = parseInt(String(hex || '#94A3B8').replace('#', ''), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function m(v) { return Math.round(v + (255 - v) * amount); }
    return '#' + [m(r), m(g), m(b)].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }
  function shade(hex, amount) {
    var n = parseInt(String(hex || '#94A3B8').replace('#', ''), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function m(v) { return Math.round(v * (1 - amount)); }
    return '#' + [m(r), m(g), m(b)].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }
  var PAL = ['#a8c0dc', '#a8dccc', '#c0a8dc', '#a8d1dc', '#a8dcb2', '#dca8da', '#a8afdc', '#a8dcd8', '#cca8dc', '#a8c6dc', '#bbdca8', '#dca8be', '#ada8dc', '#a8dcc4', '#b6a8dc', '#a8d6dc', '#dca8ce', '#a8b8dc', '#a8dca8', '#dca8b2'];
  var ASSET_LAND = 'assets/mapa-terreno.jpg', ASSET_SEA = 'assets/mapa-mar.jpg', TILE = 360;
  function sqSegDist(p, a, b) {
    var x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      var t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p[0] - x; dy = p[1] - y; return dx * dx + dy * dy;
  }
  function dpChain(pts, eps) {            // Douglas-Peucker em cadeia aberta
    var n = pts.length; if (n < 3) return pts.slice();
    var keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
    var stack = [[0, n - 1]], e2 = eps * eps;
    while (stack.length) {
      var s = stack.pop(), i = s[0], j = s[1], md = 0, mi = -1;
      for (var k = i + 1; k < j; k++) { var d = sqSegDist(pts[k], pts[i], pts[j]); if (d > md) { md = d; mi = k; } }
      if (md > e2 && mi > 0) { keep[mi] = 1; stack.push([i, mi], [mi, j]); }
    }
    var out = []; for (var q = 0; q < n; q++) if (keep[q]) out.push(pts[q]); return out;
  }
  function simplifyRing(r, eps) {         // anel aberto (sem ponto final repetido)
    var n = r.length; if (n <= 5) return r.slice();
    var far = 1, fd = -1;
    for (var i = 1; i < n; i++) { var dx = r[i][0] - r[0][0], dy = r[i][1] - r[0][1], d = dx * dx + dy * dy; if (d > fd) { fd = d; far = i; } }
    var a = dpChain(r.slice(0, far + 1), eps), b = dpChain(r.slice(far).concat([r[0]]), eps);
    var out = a.slice(0, -1).concat(b.slice(0, -1));
    return out.length >= 3 ? out : r.slice(0, 3);
  }
  function chaikin(r, t) {                // corte de cantos: contorno mais suave
    var n = r.length; if (n < 5) return r; t = t == null ? 0.2 : t; var out = [];
    for (var i = 0; i < n; i++) {
      var p = r[i], q = r[(i + 1) % n];
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], [p[0] + (q[0] - p[0]) * (1 - t), p[1] + (q[1] - p[1]) * (1 - t)]);
    }
    return out;
  }
  function ringArea(r) { var a = 0; for (var i = 0, n = r.length; i < n; i++) { var p = r[i], q = r[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function ringCentroid(r) {
    var a = 0, cx = 0, cy = 0;
    for (var i = 0, n = r.length; i < n; i++) { var p = r[i], q = r[(i + 1) % n], f = p[0] * q[1] - q[0] * p[1]; a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f; }
    if (Math.abs(a) < 1e-9) return r[0].slice();
    return [cx / (3 * a), cy / (3 * a)];
  }
  function ringD(r) {
    var s = 'M'; for (var i = 0; i < r.length; i++) s += (i ? 'L' : '') + (+r[i][0].toFixed(2)) + ' ' + (+r[i][1].toFixed(2)); return s + 'Z';
  }
  function parseGeom(g) {
    if (!g) return null;
    if (typeof g === 'string') { try { g = JSON.parse(g); } catch (e) { return null; } }
    if (g.type === 'Feature') g = g.geometry;
    if (!g || !g.coordinates || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return null;
    return g;
  }
  function geomPolys(g) { return g.type === 'Polygon' ? [g.coordinates] : g.coordinates; }
  function scanBounds(g, b) {
    geomPolys(g).forEach(function (poly) { poly.forEach(function (ring) { ring.forEach(function (pt) {
      if (pt[0] < b.minLon) b.minLon = pt[0]; if (pt[0] > b.maxLon) b.maxLon = pt[0];
      if (pt[1] < b.minLat) b.minLat = pt[1]; if (pt[1] > b.maxLat) b.maxLat = pt[1];
    }); }); });
  }
  function makeProj(b) {
    var cos = Math.cos((b.minLat + b.maxLat) / 2 * Math.PI / 180);
    return { W: (b.maxLon - b.minLon) * cos * SCALE, H: (b.maxLat - b.minLat) * SCALE,
      f: function (pt) { return [(pt[0] - b.minLon) * cos * SCALE, (b.maxLat - pt[1]) * SCALE]; } };
  }
  /* Converte a geometria em dois níveis de detalhe: d0 (estado/região, suavizado) e d1 (município isolado). */
  function processGeometry(g, proj) {
    var polys = geomPolys(g), outer = [], d0 = [], d1 = [];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, bestA = -1, cen = null;
    polys.forEach(function (poly) {
      var rings = poly.map(function (ring) {
        var pts = ring.map(proj.f);
        if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
        return pts;
      }).filter(function (r) { return r.length >= 3; });
      if (!rings.length) return;
      var oa = Math.abs(ringArea(rings[0]));
      rings[0].forEach(function (p) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });
      if (oa > bestA) { bestA = oa; cen = ringCentroid(rings[0]); }
      outer.push(oa);
      rings.forEach(function (r, idx) {
        if (idx > 0 && Math.abs(ringArea(r)) < 0.03) return;     // descarta ruído em furos
        if (idx === 0 && oa < 0.03 && polys.length > 1) return;  // descarta ilhotas minúsculas
        var c0 = simplifyRing(r, EPS_COARSE); c0 = chaikin(c0, 0.2);
        d0.push(ringD(c0)); d1.push(ringD(simplifyRing(r, EPS_FINE)));
      });
    });
    if (!d0.length || !isFinite(minX)) return null;
    return { d0: d0.join(''), d1: d1.join(''), bb: [minX, minY, maxX, maxY], c: cen, area: bestA };
  }
  function buildGeo(rows) {
    var feats = [], seen = {}, b = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
    (rows || []).forEach(function (r) {
      var g = parseGeom(r && r.boundary_geojson); if (!g || !r.name || seen[r.id]) return; seen[r.id] = 1;
      feats.push({ id: String(r.id), code: String(r.ibge_code || ''), name: r.name, g: g }); scanBounds(g, b);
    });
    if (!feats.length || !isFinite(b.minLon)) throw new Error('Nenhum limite municipal válido foi retornado.');
    var proj = makeProj(b), munis = [];
    feats.forEach(function (f) { var p = processGeometry(f.g, proj); if (p) munis.push({ id: f.id, code: f.code, name: f.name, d0: p.d0, d1: p.d1, bb: p.bb, c: p.c }); });
    return { v: CACHE_V, savedAt: Date.now(), W: proj.W, H: proj.H, munis: munis };
  }
  function nearestMunis(munisById, fromId, eligibleIds, k) {
    var from = munisById.get(String(fromId)); if (!from) return [];
    var out = [];
    eligibleIds.forEach(function (id) {
      if (String(id) === String(fromId)) return; var m = munisById.get(String(id)); if (!m) return;
      var dx = m.c[0] - from.c[0], dy = m.c[1] - from.c[1];
      out.push({ id: m.id, dist: Math.sqrt(dx * dx + dy * dy) * KM_PER_UNIT });
    });
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out.slice(0, k);
  }
  function normStatus(raw) {
    var v = norm(raw).replace(/ /g, '_');
    if (v === 'active' || v === 'ativo') return 'active';
    if (v === 'inactive' || v === 'inativo') return 'inactive';
    if (v === 'in_activation' || v === 'em_ativacao' || v === 'ativacao' || v === 'em_implantacao' || v === 'implantacao') return 'activation';
    if (v === 'reactivation' || v === 'em_reativacao' || v === 'reativacao') return 'reactivation';
    return 'inactive';
  }

  /* Linha da costa a partir dos limites reais: x máximo (leste) de cada faixa horizontal; prolonga para norte (PR) e sul (RS). */
  function coastProfile(munis, W, H, step) {
    step = step || 3; var n = Math.ceil(H / step) + 1, mx = [], i, b;
    for (i = 0; i < n; i++) mx.push(-Infinity);
    munis.forEach(function (m) {
      String(m.d0 || '').split('M').forEach(function (ring) {
        var nums = ring.match(/-?\d+(?:\.\d+)?/g); if (!nums || nums.length < 4) return;
        var pts = []; for (var k = 0; k + 1 < nums.length; k += 2) pts.push([+nums[k], +nums[k + 1]]);
        for (var j = 0; j < pts.length; j++) {
          var p = pts[j], q = pts[(j + 1) % pts.length];
          var y0 = Math.min(p[1], q[1]), y1 = Math.max(p[1], q[1]);
          for (b = Math.max(0, Math.ceil(y0 / step)); b <= Math.min(n - 1, Math.floor(y1 / step)); b++) {
            var y = b * step, x = q[1] === p[1] ? Math.max(p[0], q[0]) : p[0] + (y - p[1]) / (q[1] - p[1]) * (q[0] - p[0]);
            if (x > mx[b]) mx[b] = x;
          }
        }
      });
    });
    var f = -1, l = -1; for (i = 0; i < n; i++) if (isFinite(mx[i])) { if (f < 0) f = i; l = i; }
    if (f < 0) return [[W, -900], [W, H + 900]];
    for (i = f; i <= l; i++) if (!isFinite(mx[i])) {                       // preenche buracos
      var a = i - 1, c = i + 1; while (!isFinite(mx[c]) && c < l) c++;
      mx[i] = mx[a] + (mx[c] - mx[a]) * (i - a) / (c - a);
    }
    for (i = f + 1; i < l; i++) mx[i] = (mx[i - 1] + mx[i] * 2 + mx[i + 1]) / 4;      // suaviza
    function slope(from, to) { var k = Math.max(4, Math.min(30, to - from)); var s = (mx[to] - mx[to - k]) / (k * step); return Math.max(-.9, Math.min(.9, isFinite(s) ? s : 0)); }
    var out = [];
    var sT = (mx[Math.min(l, f + 30)] - mx[f]) / (Math.min(l, f + 30) - f) / step; sT = Math.max(-.9, Math.min(.9, isFinite(sT) ? sT : 0));
    var sB = slope(Math.max(f, l - 30), l);
    for (var yy = -900; yy < f * step; yy += step * 4) out.push([mx[f] + sT * (yy - f * step), yy]);
    for (i = f; i <= l; i++) out.push([mx[i], i * step]);
    for (var y2 = l * step + step * 4; y2 <= H + 900; y2 += step * 4) out.push([mx[l] + sB * (y2 - l * step), y2]);
    return out;
  }
  var PURE = { coastProfile: coastProfile, norm: norm, simplifyRing: simplifyRing, chaikin: chaikin, processGeometry: processGeometry, buildGeo: buildGeo, nearestMunis: nearestMunis, normStatus: normStatus, makeProj: makeProj, ringArea: ringArea, KM_PER_UNIT: KM_PER_UNIT };
  if (typeof module !== 'undefined' && module.exports) { module.exports = PURE; }
  if (typeof document === 'undefined') return;

  /* ===================== cache (IndexedDB com reserva em memória) ===================== */
  var geoMem = null, geoPromise = null;
  function idbOpen() {
    return new Promise(function (res, rej) {
      try { var r = indexedDB.open('adhonep-map', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }
      catch (e) { rej(e); }
    });
  }
  function idbGet(k) { return idbOpen().then(function (db) { return new Promise(function (res, rej) { var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { rej(q.error); }; }); }).catch(function () { return null; }); }
  function idbSet(k, v) { return idbOpen().then(function (db) { return new Promise(function (res) { var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res; }); }).catch(function () { }); }
  function idbDel(k) { return idbOpen().then(function (db) { return new Promise(function (res) { var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; t.onerror = res; }); }).catch(function () { }); }

  async function downloadGeo(progress) {
    var PAGE = 60, N = 6, done = 0;
    var pages = await Promise.all(Array.from({ length: N }, function (_, i) {
      return adhFetch('/rest/v1/municipalities?select=id,ibge_code,name,boundary_geojson&order=id.asc&limit=' + PAGE + '&offset=' + (i * PAGE))
        .then(function (r) { done++; if (progress) progress(done, N); return Array.isArray(r) ? r : []; });
    }));
    var rows = pages.reduce(function (a, p) { return a.concat(p); }, []);
    var last = pages[N - 1].length, off = N * PAGE;
    while (last === PAGE && off < 2000) {                      // segurança: mais de 360 municípios
      var more = await adhFetch('/rest/v1/municipalities?select=id,ibge_code,name,boundary_geojson&order=id.asc&limit=' + PAGE + '&offset=' + off);
      if (!Array.isArray(more) || !more.length) break; rows = rows.concat(more); last = more.length; off += PAGE;
    }
    return buildGeo(rows);
  }
  function getGeo(force, progress) {
    if (!force && geoMem) return Promise.resolve(geoMem);
    if (geoPromise) return geoPromise;
    geoPromise = (async function () {
      if (!force) {
        var c = await idbGet('geo');
        if (c && c.v === CACHE_V && Array.isArray(c.munis) && c.munis.length >= 100 && Date.now() - c.savedAt < CACHE_TTL) { geoMem = c; return c; }
      }
      var g = await downloadGeo(progress); geoMem = g; idbSet('geo', g); return g;
    })().finally(function () { geoPromise = null; });
    return geoPromise;
  }

  /* ===================== controlador do mapa ===================== */
  var NS = 'http://www.w3.org/2000/svg';
  var ST = {
    active: { label: 'Ativo', color: '#e8b73a' },
    activation: { label: 'Em ativação', color: '#4fb3d9' },
    reactivation: { label: 'Em reativação', color: '#a994f0' },
    inactive: { label: 'Inativo', color: '#ee7f78' }
  };
  var ST_ORDER = ['active', 'reactivation', 'activation', 'inactive'];
  var RING_PX = 0.35, STATE_PX = 0.7, CLOSE_PX = 0.6;
  function $(id) { return document.getElementById(id); }
  function reduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function regionColor(name) { return typeof adhRegionColor === 'function' ? adhRegionColor(name) : '#94A3B8'; }

  function createMap(mode) {
    var pub = mode === 'public';
    var ids = pub ? { box: 'officialMap', detail: 'mapCityDetail', label: 'publicMapFocusLabel' } : { box: 'adminOfficialMap', detail: 'adminMapDetail', label: 'adminMapFocusLabel' };
    var S = { loaded: false, loading: null, munis: [], byId: new Map(), regions: new Map(), chBy: new Map(), chapters: [], st: { level: 0, region: null, muni: null },
      near: [], statusFilter: null, vb: null, anim: 0, hover: false, followed: false, sig: '', els: {}, ro: null };
    var api = {};

    function box() { return $(ids.box); }

    /* ---------- dados ---------- */
    function publicChapters() {
      var list = (typeof chapters !== 'undefined' && Array.isArray(chapters)) ? chapters : [];
      var byName = {}; S.munis.forEach(function (m) { byName[norm(m.name)] = m.id; });
      return list.filter(function (c) { return typeof isPublicChapter === 'function' ? isPublicChapter(c) : (c.status === 'Ativo' && c.published === true); })
        .map(function (c) {
          var mid = c.municipalityId != null ? String(c.municipalityId) : (byName[norm(c.city)] || null);
          return { id: c.id, name: c.name, number: c.chapter_number, muni: mid, regionName: c.region, status: 'active', published: true, president: c.president || '', address: c.address || '', contact: c.contact || '' };
        });
    }
    function assignChapters(list) {
      S.chapters = list; S.chBy = new Map();
      list.forEach(function (c) { if (!c.muni) return; var k = String(c.muni); if (!S.chBy.has(k)) S.chBy.set(k, []); S.chBy.get(k).push(c); });
    }
    function muniStatus(id) {      // situação "dominante" do município
      var cs = S.chBy.get(String(id)); if (!cs || !cs.length) return 'none';
      for (var i = 0; i < ST_ORDER.length; i++) if (cs.some(function (c) { return c.status === ST_ORDER[i]; })) return ST_ORDER[i];
      return 'none';
    }
    function hasPublicChapter(id) { return pub ? S.chBy.has(String(id)) : false; }

    function buildModel(geo, regs, links, chRows) {
      var rname = new Map((regs || []).map(function (r) { return [String(r.id), r.name || ('Região #' + r.id)]; }));
      var link = new Map(); (links || []).forEach(function (x) { if (x.municipality_id != null && x.region_id != null) link.set(String(x.municipality_id), String(x.region_id)); });
      if (!pub && Array.isArray(chRows)) chRows.forEach(function (c) { if (c.municipality_id != null && c.region_id != null && !link.has(String(c.municipality_id))) link.set(String(c.municipality_id), String(c.region_id)); });
      S.munis = geo.munis.map(function (m) { var rid = link.get(String(m.id)) || '0'; return Object.assign({}, m, { regionId: rid }); });
      S.byId = new Map(S.munis.map(function (m) { return [m.id, m]; }));
      S.W = geo.W; S.H = geo.H;
      S.regions = new Map();
      S.munis.forEach(function (m) {
        if (!S.regions.has(m.regionId)) S.regions.set(m.regionId, { id: m.regionId, name: m.regionId === '0' ? 'Sem região definida' : (rname.get(m.regionId) || ('Região #' + m.regionId)), munis: [] });
        S.regions.get(m.regionId).munis.push(m);
      });
      S.regions.forEach(function (r) {
        function med(a) { var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; }
        var mx = med(r.munis.map(function (m) { return m.c[0]; })), my = med(r.munis.map(function (m) { return m.c[1]; }));
        var ds = r.munis.map(function (m) { return Math.sqrt(Math.pow(m.c[0] - mx, 2) + Math.pow(m.c[1] - my, 2)); }), thr = Math.max(med(ds) * 3.2, 30);
        r.core = []; r.out = [];
        r.munis.forEach(function (m, i) { (r.id === '0' || ds[i] <= thr ? r.core : r.out).push(m); });
        if (!r.core.length) { r.core = r.munis; r.out = []; }
        var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sx = 0, sy = 0, sw = 0;
        r.core.forEach(function (m) { x0 = Math.min(x0, m.bb[0]); y0 = Math.min(y0, m.bb[1]); x1 = Math.max(x1, m.bb[2]); y1 = Math.max(y1, m.bb[3]); var w = Math.max(1, (m.bb[2] - m.bb[0]) * (m.bb[3] - m.bb[1])); sx += m.c[0] * w; sy += m.c[1] * w; sw += w; });
        r.bb = [x0, y0, x1, y1]; r.label = [sx / sw, sy / sw]; r.color = '#5b6b82'; r.num = 0;
      });
      var real = Array.from(S.regions.values()).filter(function (r) { return r.id !== '0'; });
      real.sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); }).forEach(function (r) { r.num = 1; });
      real.slice().sort(function (a, b) { return (a.label[0] + a.label[1] * .4) - (b.label[0] + b.label[1] * .4); }).forEach(function (r, i) { r.color = PAL[i % PAL.length]; });
      if (pub) assignChapters(publicChapters());
      else assignChapters((chRows || []).map(function (c) {
        return { id: c.id, name: c.name, number: c.chapter_number, muni: c.municipality_id != null ? String(c.municipality_id) : null, status: normStatus(c.status), published: c.is_public === true, president: c.president_name || '', address: c.address || '' };
      }));
      S.sig = signature();
    }
    function signature() {
      if (!pub) return '';
      return ((typeof chapters !== 'undefined' && chapters) || []).map(function (c) { return c.id + ':' + c.status + ':' + c.published + ':' + c.municipalityId; }).join('|');
    }

    /* ---------- carregamento ---------- */
    function setLoading(msg, sub) {
      var b = box(); if (!b) return;
      b.innerHTML = '<div class="amap-loading" role="status"><div class="amap-spin" aria-hidden="true"></div><strong>' + esc(msg) + '</strong>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>';
    }
    function showError(err) {
      var b = box(); if (!b) return;
      b.innerHTML = '<div class="amap-loading"><strong>Não foi possível carregar o mapa.</strong><p>' + esc((err && err.message) || 'Erro de conexão') + '</p><button class="btn primary" type="button" data-retry>Tentar novamente</button></div>';
      var r = b.querySelector('[data-retry]'); if (r) r.onclick = function () { api.load(true); };
    }
    api.load = function (opts) {
      opts = opts === true ? { geo: true } : (opts || {});
      var b = box(); if (!b) return Promise.resolve();
      if (S.loading) return S.loading;
      if (!pub && !(typeof adhSession !== 'undefined' && adhSession)) {
        b.innerHTML = '<div class="amap-loading"><strong>Mapa administrativo</strong><p>Entre com a sua conta para ver os capítulos por situação.</p></div>';
        if (typeof openRealLogin === 'function') openRealLogin(); return Promise.resolve();
      }
      S.loading = (async function () {
        try {
          var cached = !opts.geo && geoMem;
          if (!S.loaded || opts.geo) setLoading(cached ? 'Montando o mapa…' : 'Preparando o mapa de Santa Catarina…', cached ? '' : 'Na primeira visita os limites dos municípios são baixados e guardados neste aparelho. Nas próximas, o mapa abre na hora.');
          var geoP = getGeo(!!opts.geo, function (d, n) { if (!cached) setLoading('Preparando o mapa de Santa Catarina…', 'Baixando limites municipais (' + d + ' de ' + n + ')'); });
          var reqs = [adhFetch('/rest/v1/regions?select=id,name&limit=500'), adhFetch('/rest/v1/region_municipalities?select=municipality_id,region_id&valid_until=is.null&limit=1000')];
          if (!pub) reqs.push(adhFetch('/rest/v1/chapters?select=id,name,chapter_number,municipality_id,region_id,status,is_public,president_name&order=name.asc&limit=2000'));
          var res = await Promise.all([geoP].concat(reqs));
          if (!Array.isArray(res[2])) throw new Error('A consulta de vínculos regionais retornou um formato inesperado (confira a política de leitura de region_municipalities).');
          buildModel(res[0], res[1], res[2], res[3]);
          render(); S.loaded = true;
          if (!pub) { try { if (typeof renderMapIntegratedMetrics === 'function') renderMapIntegratedMetrics(res[3]); var ms = $('adminMapStatus'); if (ms) ms.textContent = S.munis.length + ' municípios · ' + S.chapters.length + ' capítulos (todos os status, inclusive não publicados).'; } catch (e) { } }
          if (geoMem && Date.now() - geoMem.savedAt > 7 * 24 * 3600 * 1000 && !opts.geo) getGeo(true).catch(function () { });   // renova em segundo plano
        } catch (e) { showError(e); console.warn('mapa:', e); }
        finally { S.loading = null; }
      })();
      return S.loading;
    };
    api.updateChapters = function () {
      if (!S.loaded || !pub) return; var s = signature(); if (s === S.sig) return; S.sig = s;
      assignChapters(publicChapters()); paintMunis(); applyVisibility(); renderPanel(); renderLegend();
    };

    /* ---------- renderização ---------- */
    function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
    function render() {
      var b = box(); if (!b) return;
      b.innerHTML = '<div class="amap amap-' + mode + '"><div class="amap-stage"><div class="amap-crumbs" role="navigation" aria-label="Navegação do mapa"></div><div class="amap-tip" hidden></div><div class="amap-compass" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="none" stroke="rgba(255,255,255,.35)"/><path d="M32 6l6 26-6 6-6-6z" fill="#e8c46b"/><path d="M32 58l-6-26 6-6 6 6z" fill="rgba(255,255,255,.55)"/><text x="32" y="5" font-size="8" text-anchor="middle" fill="#fff" font-family="Inter,sans-serif" font-weight="700">N</text></svg></div><div class="amap-scale" aria-hidden="true"><i></i><span></span></div></div><div class="amap-stats"></div><div class="amap-legend"></div><div class="amap-regions"></div></div>';
      var stage = b.querySelector('.amap-stage');
      var svg = el('svg', { class: 'amap-svg', role: 'group', 'aria-label': 'Mapa dos municípios de Santa Catarina', preserveAspectRatio: 'xMidYMid meet' });
      stage.insertBefore(svg, stage.firstChild);
      var defs = el('defs', {}, svg);
      var gold = el('linearGradient', { id: 'g-gold-' + mode, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
      [['0', '#fff0b8'], ['.5', '#f0c54f'], ['1', '#c9942a']].forEach(function (s) { el('stop', { offset: s[0], 'stop-color': s[1] }, gold); });
      S.regions.forEach(function (r) {
        var g = el('linearGradient', { id: 'rg-' + mode + '-' + r.id, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
        [['0', mix(r.color, .12)], ['.6', r.color], ['1', shade(r.color, .1)]].forEach(function (s) { el('stop', { offset: s[0], 'stop-color': s[1] }, g); });
      });
      if (!pub) ST_ORDER.forEach(function (k) {
        var g = el('linearGradient', { id: 'sg-' + k, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
        (k === 'active' ? [['0', '#fff0b8'], ['.5', '#f0c54f'], ['1', '#c9942a']] : [['0', mix(ST[k].color, .2)], ['1', shade(ST[k].color, .12)]]).forEach(function (s) { el('stop', { offset: s[0], 'stop-color': s[1] }, g); });
      });
      var rings = [];
      S.regions.forEach(function (r) {
        var f = el('filter', { id: 'ringf-' + mode + '-' + r.id, 'color-interpolation-filters': 'sRGB', x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs);
        el('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: 1, result: 'd', class: 'rd' }, f);
        el('feMorphology', { in: 'd', operator: 'erode', radius: 2, result: 'e', class: 'rr' }, f);
        el('feComposite', { in: 'd', in2: 'e', operator: 'out', result: 'ring' }, f);
        el('feFlood', { 'flood-color': '#ffffff', 'flood-opacity': '.7' }, f);
        el('feComposite', { in2: 'ring', operator: 'in' }, f);
        rings.push(r);
      });
      var sf = el('filter', { id: 'statef-' + mode, 'color-interpolation-filters': 'sRGB', x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs);
      el('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: 1, result: 'd', class: 'sd' }, sf);
      el('feMorphology', { in: 'd', operator: 'erode', radius: 2, result: 'e', class: 'rs' }, sf);
      el('feComposite', { in: 'd', in2: 'e', operator: 'out', result: 'ring' }, sf);
      el('feFlood', { 'flood-color': '#e4f1ff', 'flood-opacity': '.85' }, sf);
      el('feComposite', { in2: 'ring', operator: 'in' }, sf);
      S.munis.forEach(function (m) { el('path', { id: 'rp-' + mode + '-' + m.id, d: m.d0, fill: '#000', stroke: '#000', 'stroke-width': .5, 'stroke-linejoin': 'round' }, defs); });

      var gB = el('g', { class: 'amap-terrain', 'pointer-events': 'none' }, svg);
      ['land', 'sea'].forEach(function (k) {
        var pt = el('pattern', { id: 'tex-' + k + '-' + mode, patternUnits: 'userSpaceOnUse', width: TILE, height: TILE }, defs);
        el('image', { href: k === 'land' ? ASSET_LAND : ASSET_SEA, x: 0, y: 0, width: TILE, height: TILE, preserveAspectRatio: 'none' }, pt);
      });
      var coast = coastProfile(S.munis, S.W, S.H, 3), line = coast.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('');
      var seaD = 'M' + coast[0][0].toFixed(1) + ' -6000' + line.replace(/^M/, 'L') + 'L' + coast[coast.length - 1][0].toFixed(1) + ' 6000L7000 6000L7000 -6000Z';
      el('rect', { x: -6000, y: -6000, width: 13000, height: 12000, fill: 'url(#tex-land-' + mode + ')' }, gB);
      el('rect', { x: -6000, y: -6000, width: 13000, height: 12000, fill: '#03101f', 'fill-opacity': .38 }, gB);
      el('path', { d: seaD, fill: 'url(#tex-sea-' + mode + ')' }, gB);
      el('path', { d: seaD, fill: '#03101f', 'fill-opacity': .3 }, gB);
      [[46, .05], [28, .07], [14, .1], [6, .14]].forEach(function (w) { el('path', { d: line, fill: 'none', stroke: '#8fd8ff', 'stroke-opacity': w[1], 'stroke-width': w[0], 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, gB); });
      el('rect', { class: 'amap-bg', x: -6000, y: -6000, width: 12000, height: 12000, fill: 'transparent' }, svg);
      var gM = el('g', { class: 'l-muni' }, svg), gR = el('g', { class: 'l-ring', 'pointer-events': 'none' }, svg), gS = el('g', { class: 'l-state', 'pointer-events': 'none' }, svg), gL = el('g', { class: 'l-labels', 'pointer-events': 'none' }, svg);
      S.paths = new Map();
      var order = S.munis.slice().sort(function (a, b) { return (muniStatus(a.id) !== 'none') - (muniStatus(b.id) !== 'none'); });
      order.forEach(function (m) {
        var p = el('path', { class: 'muni', d: m.d0, 'fill-rule': 'evenodd', 'data-id': m.id, role: 'img', 'aria-label': m.name }, gM);
        S.paths.set(m.id, p);
      });
      rings.forEach(function (r) { var g = el('g', { class: 'ring', 'data-r': r.id, filter: 'url(#ringf-' + mode + '-' + r.id + ')' }, gR); r.munis.forEach(function (m) { el('use', { href: '#rp-' + mode + '-' + m.id }, g); }); });
      var gs = el('g', { filter: 'url(#statef-' + mode + ')' }, gS); S.munis.forEach(function (m) { el('use', { href: '#rp-' + mode + '-' + m.id }, gs); });

      S.els = { stats: b.querySelector('.amap-stats'), regs: b.querySelector('.amap-regions'), scale: stage.querySelector('.amap-scale'), svg: svg, stage: stage, gM: gM, gR: gR, gS: gS, gL: gL, tip: stage.querySelector('.amap-tip'), crumbs: stage.querySelector('.amap-crumbs'), legend: b.querySelector('.amap-legend') };
      S.vb = fit([0, 0, S.W, S.H]); applyVB(S.vb);
      paintMunis(); applyVisibility();
      svg.addEventListener('click', onClick); svg.addEventListener('mousemove', onMove); svg.addEventListener('mouseleave', hideTip);
      svg.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('muni')) { e.preventDefault(); clickMuni(e.target.getAttribute('data-id')); } });
      b.addEventListener('mouseenter', function () { S.hover = true; }); b.addEventListener('mouseleave', function () { S.hover = false; });
      if (S.ro) S.ro.disconnect();
      if (root.ResizeObserver) { S.ro = new ResizeObserver(function () { if (!S.anim) { S.vb = fit(targetBBox()); applyVB(S.vb); updateRings(); renderLabels(); } }); S.ro.observe(stage); }
      renderLegend(); fillCityList();
      go(S.st.level && S.byId.has(S.st.muni || '') ? S.st.level : 0, S.st.region, S.st.muni, { animate: false, keep: true });
    }

    function paintMunis() {
      S.munis.forEach(function (m) {
        var p = S.paths.get(m.id); if (!p) return;
        var r = S.regions.get(m.regionId), st = muniStatus(m.id);
        p.style.setProperty('--tint', r ? 'url(#rg-' + mode + '-' + r.id + ')' : '#3a4a60');
        var cls = 'muni';
        if (pub) { if (st !== 'none') cls += ' has-ch'; }
        else cls += ' st-' + st;
        p.setAttribute('class', cls);
        p.setAttribute('aria-label', m.name + (pub ? (st !== 'none' ? ' — capítulo ativo' : '') : (st !== 'none' ? ' — ' + ST[st].label : '')));
      });
    }
    function fillCityList() {
      if (!pub) { var sl = $('adminRegionFocus'); if (sl) { sl.innerHTML = '<option value="">Todas as regiões</option>' + Array.from(S.regions.values()).filter(function (x) { return x.id !== '0'; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); }).map(function (x) { return '<option>' + esc(x.name) + '</option>'; }).join(''); sl.disabled = false; } return; }
      var dl = $('cityList'); if (!dl) return;
      dl.innerHTML = S.munis.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); }).map(function (m) { return '<option value="' + esc(m.name) + '"></option>'; }).join('');
      var inp = $('findChapter'); if (inp) inp.setAttribute('list', 'cityList');
    }
    function renderExtras() {
      var st = S.els.stats; if (st) {
        var nr = 0; S.regions.forEach(function (r) { if (r.num) nr++; });
        st.innerHTML = '<div><b>' + nr + '</b><span>Regiões</span></div><div><b>' + S.munis.length + '</b><span>Municípios em SC</span></div><div><b>' + S.chapters.length + '</b><span>' + (pub ? 'Capítulos ativos' : 'Capítulos') + '</span></div>';
      }
      var rg = S.els.regs; if (rg) {
        var cnt = new Map(); S.chapters.forEach(function (c) { var mm = S.byId.get(String(c.muni)); if (mm) cnt.set(mm.regionId, (cnt.get(mm.regionId) || 0) + 1); });
        rg.innerHTML = '<div class="rg-title">Regiões da ADHONEP-SC</div><div class="rg-grid">' + Array.from(S.regions.values()).filter(function (r) { return r.num; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); }).map(function (r) {
          return '<button type="button" class="rg" data-r="' + esc(r.id) + '"><i style="background:' + r.color + '"></i><span>' + esc(r.name) + '</span><b>' + (cnt.get(r.id) || 0) + '</b></button>'; }).join('') + '</div>';
        rg.querySelectorAll('.rg').forEach(function (b) {
          b.onclick = function () { go(1, b.getAttribute('data-r')); };
          b.onmouseenter = function () { hiRegion(b.getAttribute('data-r')); }; b.onmouseleave = function () { hiRegion(null); };
        });
      }
    }
    function hiRegion(id) {
      if (!S.paths) return;
      S.paths.forEach(function (p, mid) { var m = S.byId.get(mid); p.classList.toggle('is-lo', S.st.level === 0 && !!id && m.regionId !== id); });
    }
    function updateScale() {
      var sc = S.els.scale; if (!sc || !S.vb) return; var k = S.vb.w / (S.els.svg.clientWidth || 800), px = 1 / k;
      var steps = [200, 100, 50, 20, 10, 5, 2, 1, .5], km = steps[steps.length - 1];
      for (var i = 0; i < steps.length; i++) { if (steps[i] / KM_PER_UNIT * px <= 120) { km = steps[i]; break; } }
      sc.querySelector('i').style.width = (km / KM_PER_UNIT * px).toFixed(0) + 'px'; sc.querySelector('span').textContent = km + ' km';
    }
    function renderLegend() {
      renderExtras();
      var L = S.els.legend; if (!L) return;
      if (pub) {
        var n = 0; S.chBy.forEach(function () { n++; });
        L.innerHTML = '<span class="lg"><i class="sw gold"></i>Município com capítulo ativo e publicado <b>' + n + '</b></span><span class="lg"><i class="sw ring"></i>Limite de região</span>';
        return;
      }
      var cnt = { active: 0, activation: 0, reactivation: 0, inactive: 0 }, none = 0;
      S.chapters.forEach(function (c) { cnt[c.status] = (cnt[c.status] || 0) + 1; });
      S.munis.forEach(function (m) { if (muniStatus(m.id) === 'none') none++; });
      L.innerHTML = ST_ORDER.map(function (k) { return '<button type="button" class="lg lg-btn' + (S.statusFilter === k ? ' on' : '') + '" data-st="' + k + '" aria-pressed="' + (S.statusFilter === k) + '"><i class="sw" style="background:' + ST[k].color + '"></i>' + ST[k].label + ' <b>' + cnt[k] + '</b></button>'; }).join('')
        + '<button type="button" class="lg lg-btn' + (S.onlyNone ? ' on' : '') + '" data-none aria-pressed="' + !!S.onlyNone + '" title="Mostrar somente os municípios sem capítulo"><i class="sw soft"></i>Município sem capítulo <b>' + none + '</b>' + (S.onlyNone ? ' <em class="lg-off">só estes</em>' : '') + '</button><button type="button" class="lg lg-link" data-refresh>Atualizar limites municipais</button>';
      L.querySelectorAll('[data-st]').forEach(function (b) { b.onclick = function () { S.statusFilter = S.statusFilter === b.dataset.st ? null : b.dataset.st; S.onlyNone = false; renderLegend(); applyVisibility(); }; });
      var nb = L.querySelector('[data-none]'); if (nb) nb.onclick = function () { S.onlyNone = !S.onlyNone; if (S.onlyNone) S.statusFilter = null; renderLegend(); applyVisibility(); };
      var rf = L.querySelector('[data-refresh]'); if (rf) rf.onclick = function () { api.load({ geo: true }); };
    }

    /* ---------- visão (viewBox) ---------- */
    function fit(bb, pad) {
      pad = pad == null ? .06 : pad; var svg = S.els.svg;
      var cw = (svg && svg.clientWidth) || 800, ch = (svg && svg.clientHeight) || 520;
      var bw = Math.max(bb[2] - bb[0], 14), bh = Math.max(bb[3] - bb[1], 14), w = bw * (1 + 2 * pad), h = bh * (1 + 2 * pad), ar = cw / ch;
      if (w / h < ar) w = h * ar; else h = w / ar;
      var cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2; return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
    }
    function applyVB(v) { S.els.svg.setAttribute('viewBox', v.x + ' ' + v.y + ' ' + v.w + ' ' + v.h); }
    function animateTo(to, animate) {
      cancelAnimationFrame(S.anim); S.anim = 0;
      if (!animate || reduced() || !S.vb) { S.vb = to; applyVB(to); updateRings(); renderLabels(); return; }
      var from = S.vb, t0 = performance.now(), dur = 560; S.els.gR.classList.add('hold'); S.els.gS.classList.add('hold'); S.els.gL.classList.add('hold');
      (function step(now) {
        var t = Math.min(1, (now - t0) / dur), e = ease(t);
        S.vb = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e }; applyVB(S.vb);
        if (t < 1) S.anim = requestAnimationFrame(step);
        else { S.anim = 0; S.vb = to; applyVB(to); updateRings(); renderLabels(); S.els.gR.classList.remove('hold'); S.els.gS.classList.remove('hold'); S.els.gL.classList.remove('hold'); }
      })(t0);
    }
    function updateRings() {
      if (!S.els.svg) return; var pxW = S.els.svg.clientWidth || 800, k = S.vb.w / pxW;
      updateScale();
      S.els.svg.querySelectorAll('.rd').forEach(function (n) { n.setAttribute('radius', (CLOSE_PX * k).toFixed(3)); });
      S.els.svg.querySelectorAll('.rr').forEach(function (n) { n.setAttribute('radius', ((CLOSE_PX + RING_PX) * k).toFixed(3)); });
      S.els.svg.querySelectorAll('.sd').forEach(function (n) { n.setAttribute('radius', (CLOSE_PX * k).toFixed(3)); });
      S.els.svg.querySelectorAll('.rs').forEach(function (n) { n.setAttribute('radius', ((CLOSE_PX + STATE_PX) * k).toFixed(3)); });
    }
    function visibleSet() {
      var s = new Set(), L = S.st.level;
      if (L === 0) S.munis.forEach(function (m) { s.add(m.id); });
      else if (L === 1) { var rg = S.regions.get(S.st.region); if (rg) rg.core.forEach(function (m) { s.add(m.id); }); }
      else { s.add(S.st.muni); S.near.forEach(function (i) { s.add(i); }); }
      return s;
    }
    function targetBBox() {
      var L = S.st.level;
      if (L === 0) return [0, 0, S.W, S.H];
      if (L === 1) { var r = S.regions.get(S.st.region); return r ? r.bb : [0, 0, S.W, S.H]; }
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      visibleSet().forEach(function (id) { var m = S.byId.get(id); if (!m) return; x0 = Math.min(x0, m.bb[0]); y0 = Math.min(y0, m.bb[1]); x1 = Math.max(x1, m.bb[2]); y1 = Math.max(y1, m.bb[3]); });
      return isFinite(x0) ? [x0, y0, x1, y1] : [0, 0, S.W, S.H];
    }
    function applyVisibility() {
      if (!S.paths) return; var vis = visibleSet(), L = S.st.level, detail = L === 2 ? 'd1' : 'd0';
      S.paths.forEach(function (p, id) {
        var on = vis.has(id), m = S.byId.get(id), st = muniStatus(id);
        if (L !== 0) p.classList.remove('is-lo');
        p.classList.toggle('is-dim', !on);
        p.classList.toggle('is-focus', L === 2 && id === S.st.muni);
        p.classList.toggle('is-near', L === 2 && S.near.indexOf(id) >= 0);
        p.classList.toggle('is-faded', !pub && !!S.statusFilter && on && st !== S.statusFilter);
        var hid = !pub && !!S.onlyNone && on && st !== 'none'; p.classList.toggle('is-hidden', hid);
        var want = on && L === 2 && id === S.st.muni ? m.d1 : m.d0; if (p.__d !== want) { p.setAttribute('d', want); p.__d = want; }
        var inter = on && (pub ? (L === 0 || L === 1 ? true : true) : true);
        if (on && (pub ? st !== 'none' : true)) p.setAttribute('tabindex', 0); else p.removeAttribute('tabindex');
        p.style.pointerEvents = (on && !hid) ? 'auto' : 'none';
      });
      S.els.gR.querySelectorAll('.ring').forEach(function (g) { g.style.display = (L === 0 || (L === 1 && g.getAttribute('data-r') === S.st.region)) ? '' : 'none'; });
      S.els.gS.style.display = L === 0 ? '' : 'none';
      S.els.stage.setAttribute('data-level', L);
    }
    function renderLabels() {
      var g = S.els.gL; if (!g || !S.vb) return; g.innerHTML = '';
      var k = S.vb.w / (S.els.svg.clientWidth || 800), L = S.st.level, fs = 11 * k;
      var placed = [];
      function label(x, y, text, cls, size) {
        size = size || fs; var w = text.length * size * (cls.indexOf('rl') >= 0 ? .66 : .58), h = size * 1.1;
        for (var i = 0; i < placed.length; i++) { var q = placed[i]; if (Math.abs(x - q.x) < (w + q.w) / 2 + size * .25 && Math.abs(y - q.y) < (h + q.h) / 2) return; }
        placed.push({ x: x, y: y, w: w, h: h });
        var t = el('text', { x: x, y: y, class: 'amap-label ' + cls, 'font-size': size.toFixed(2), 'stroke-width': (size * .3).toFixed(2), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g); t.textContent = text;
      }
      if (L === 0) { Array.from(S.regions.values()).sort(function (a, b) { return b.munis.length - a.munis.length; }).forEach(function (r) { if (r.num) label(r.label[0], r.label[1], r.name, 'rl', 8.2 * k); }); }
      else if (L === 1) {
        var r = S.regions.get(S.st.region);
        if (r) r.core.slice().sort(function (a, b) { return (muniStatus(b.id) !== 'none') - (muniStatus(a.id) !== 'none'); }).forEach(function (m) { if (muniStatus(m.id) !== 'none') label(m.c[0], m.c[1], m.name, 'cl', 10.5 * k); });
      } else {
        visibleSet().forEach(function (id) { var m = S.byId.get(id); if (m) label(m.c[0], m.c[1], m.name, id === S.st.muni ? 'cl main' : 'cl', (id === S.st.muni ? 15 : 11) * k); });
      }
    }

    /* ---------- navegação ---------- */
    function go(level, regionId, muniId, opt) {
      opt = opt || {}; var m = muniId != null ? S.byId.get(String(muniId)) : null;
      if (level === 2 && !m) level = regionId ? 1 : 0;
      if (level >= 1 && !regionId && m) regionId = m.regionId;
      if (level >= 1 && !S.regions.has(String(regionId))) level = 0;
      S.st = { level: level, region: level >= 1 ? String(regionId) : null, muni: level === 2 ? m.id : null };
      S.near = (level === 2 && pub && !S.chBy.has(S.st.muni)) ? nearestMunis(S.byId, S.st.muni, Array.from(S.chBy.keys()), 2).map(function (x) { return x.id; }) : [];
      applyVisibility(); animateTo(fit(targetBBox()), opt.animate !== false);
      renderCrumbs(); renderPanel(); syncExternal();
    }
    function back() { var L = S.st.level; if (L === 2) go(1, S.st.region); else if (L === 1) go(0); S.followed = false; }
    function clickMuni(id) {
      var m = S.byId.get(String(id)); if (!m) return; var L = S.st.level;
      if (L === 0) go(1, m.regionId);
      else if (L === 1) { if (m.regionId === S.st.region) go(2, m.regionId, m.id); else go(1, m.regionId); }
      else if (m.id !== S.st.muni) go(2, m.regionId, m.id);
    }
    function onClick(e) { var p = e.target.closest && e.target.closest('path.muni'); if (p && !p.classList.contains('is-dim')) clickMuni(p.getAttribute('data-id')); else back(); }
    function hideTip() { if (S.els.tip) S.els.tip.hidden = true; }
    function onMove(e) {
      if (root.matchMedia && root.matchMedia('(hover: none)').matches) { hideTip(); return; }
      var p = e.target.closest && e.target.closest('path.muni'); if (!p || p.classList.contains('is-dim')) { hideTip(); return; }
      var m = S.byId.get(p.getAttribute('data-id')), r = S.regions.get(m.regionId), st = muniStatus(m.id), n = (S.chBy.get(m.id) || []).length;
      var line = pub ? (n ? n + ' capítulo(s) ativo(s)' : 'Sem capítulo ativo') : (st === 'none' ? 'Sem capítulo' : ST[st].label + (n > 1 ? ' · ' + n + ' capítulos' : ''));
      var tip = S.els.tip; tip.innerHTML = '<strong>' + esc(m.name) + '</strong><span>' + esc(r ? r.name : '') + '</span><span>' + esc(line) + '</span>'; tip.hidden = false;
      var rc = S.els.stage.getBoundingClientRect(); tip.style.left = Math.max(8, Math.min(rc.width - 190, e.clientX - rc.left + 14)) + 'px'; tip.style.top = Math.max(8, Math.min(rc.height - 80, e.clientY - rc.top + 14)) + 'px';
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.loaded && S.hover && !document.querySelector('.modal.open')) back(); });

    function renderCrumbs() {
      var c = S.els.crumbs; if (!c) return; var L = S.st.level, r = S.regions.get(S.st.region), m = S.byId.get(S.st.muni || '');
      var h = '<button type="button" data-g="0"' + (L === 0 ? ' class="cur" aria-current="true"' : '') + '>Santa Catarina</button>';
      if (L >= 1 && r) h += '<span aria-hidden="true">›</span><button type="button" data-g="1"' + (L === 1 ? ' class="cur" aria-current="true"' : '') + '>' + esc(r.name) + '</button>';
      if (L === 2 && m) h += '<span aria-hidden="true">›</span><button type="button" class="cur" aria-current="true">' + esc(m.name) + '</button>';
      if (L > 0) h += '<button type="button" class="back" data-g="b">← Voltar</button>';
      c.innerHTML = h;
      c.querySelectorAll('[data-g]').forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); var g = b.getAttribute('data-g'); if (g === '0') go(0); else if (g === '1') go(1, S.st.region); else if (g === 'b') back(); }; });
    }
    function syncExternal() {
      var r = S.regions.get(S.st.region), m = S.byId.get(S.st.muni || ''), L = S.st.level;
      var txt = L === 0 ? 'Visão geral de Santa Catarina' : L === 1 ? 'Região: ' + (r ? r.name : '') : 'Município: ' + (m ? m.name : '') + (r ? ' · ' + r.name : '');
      var lab = $(ids.label); if (lab) lab.textContent = txt;
      if (pub) {
        root.adhMapFilter = { region: L >= 1 && r ? r.name : '', city: L === 2 && m ? m.name : '' };
        var note = $('publicFilterNote');
        if (!note) { var list = $('publicList'); if (list && list.parentNode) { note = document.createElement('div'); note.id = 'publicFilterNote'; list.parentNode.insertBefore(note, list); } }
        if (note) { note.innerHTML = L === 0 ? '' : '<div class="fnote"><span>Filtrando pelo mapa: <b>' + esc(root.adhMapFilter.region) + (root.adhMapFilter.city ? ' › ' + esc(root.adhMapFilter.city) : '') + '</b></span><button type="button" class="btn small" onclick="AdhMap.reset()">Limpar</button></div>'; }
        if (typeof renderPublic === 'function') renderPublic();
      } else {
        var rs = $('adminMapReset'); if (rs) { rs.disabled = L === 0; rs.onclick = function () { go(0); }; }
        var sel = $('adminRegionFocus'); if (sel) { sel.disabled = false; sel.value = L >= 1 && r ? r.name : ''; }
      }
    }

    /* ---------- painel de informações (cada etapa) ---------- */
    function chip(label, count, onclick) { return '<button type="button" class="achip" onclick="' + onclick + '">' + esc(label) + (count != null ? ' <b>' + count + '</b>' : '') + '</button>'; }
    function nearHtml(muniId) {
      var list = nearestMunis(S.byId, muniId, Array.from(S.chBy.keys()), 2); if (!list.length) return '<p>Ainda não há capítulos publicados perto deste município.</p>';
      return '<div class="nearby">' + list.map(function (n) {
        var m = S.byId.get(n.id), cs = S.chBy.get(n.id) || [], c = cs[0];
        return '<div class="near-card"><div><strong>' + esc(c ? ((c.number != null ? String(c.number).padStart(3, '0') + ' — ' : '') + c.name) : m.name) + '</strong><span>' + esc(m.name) + ' · a cerca de ' + Math.max(1, Math.round(n.dist)) + ' km</span></div><button type="button" class="btn small" onclick="AdhMap.goMuni(\'' + esc(m.id) + '\')">Ver no mapa</button></div>';
      }).join('') + '</div>';
    }
    function chapterCard(c) {
      if (pub) return '<div class="detail"><strong>' + esc((c.number != null ? String(c.number).padStart(3, '0') + ' — ' : '') + c.name) + '</strong>' + (c.address ? '<p>Endereço: ' + esc(c.address) + '</p>' : '') + (typeof adhContactHtml === 'function' ? adhContactHtml(c, 'Contato público a confirmar') : '<p>Contato: ' + esc(c.contact || 'Contato público a confirmar') + '</p>') + '</div>';
      return '<div class="detail"><div class="statusline"><span class="tag ' + ({ active: 'active', inactive: 'inactive', activation: 'activation', reactivation: 'reactivation' }[c.status]) + '">' + ST[c.status].label + '</span><span class="tag ' + (c.published ? 'active' : 'inactive') + '">' + (c.published ? 'Público' : 'Não público') + '</span></div><strong>' + esc((c.number != null ? String(c.number).padStart(3, '0') + ' — ' : '') + c.name) + '</strong>' + (c.president ? '<p>Presidente: ' + esc(c.president) + '</p>' : '') + (c.address ? '<p>Endereço: ' + esc(c.address) + '</p>' : '') + (typeof canEdit === 'function' && canEdit('chapter', true) && typeof openChapter === 'function' ? '<div class="actions" style="margin-top:8px"><button class="btn small" type="button" onclick="openChapter(' + Number(c.id) + ')">Editar capítulo</button></div>' : '') + '</div>';
    }
    function renderPanel() {
      var d = $(ids.detail); if (!d || !S.loaded && !S.munis.length) return;
      var L = S.st.level, r = S.regions.get(S.st.region), m = S.byId.get(S.st.muni || ''), html = '';
      var head = function (t, sub) { return pub ? '<strong>' + esc(t) + '</strong>' + (sub ? '<p>' + sub + '</p>' : '') : '<h4>' + esc(t) + '</h4>' + (sub ? '<p class="sub">' + sub + '</p>' : ''); };
      if (L === 0) {
        if (pub) {
          var nm = 0; S.chBy.forEach(function () { nm++; }); var rc = new Map();
          S.chapters.forEach(function (c) { var mm = S.byId.get(String(c.muni)); if (mm) rc.set(mm.regionId, (rc.get(mm.regionId) || 0) + 1); });
          html = head('Santa Catarina', '<b>' + S.chapters.length + '</b> capítulos ativos em <b>' + nm + '</b> municípios. Clique numa região do mapa para explorar.') +
            '<div class="chips">' + Array.from(S.regions.values()).filter(function (x) { return x.id !== '0'; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); }).map(function (x) { return chip(x.name, rc.get(x.id) || 0, "AdhMap.goRegion('" + esc(x.id) + "')"); }).join('') + '</div>';
        } else {
          var cnt = { active: 0, activation: 0, reactivation: 0, inactive: 0 }; S.chapters.forEach(function (c) { cnt[c.status]++; });
          html = head('Santa Catarina', S.chapters.length + ' capítulos cadastrados em ' + S.regions.size + ' regiões.') + '<div class="detail"><div class="statline">' + ST_ORDER.map(function (k) { return '<span><i class="sw" style="background:' + ST[k].color + '"></i>' + ST[k].label + ': <b>' + cnt[k] + '</b></span>'; }).join('') + '</div></div><p class="sub" style="margin-top:12px">Clique numa região para isolá-la. Use a legenda para destacar uma situação.</p><div class="chips">' + Array.from(S.regions.values()).filter(function (x) { return x.id !== '0'; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); }).map(function (x) { return chip(x.name, null, "AdhMap.goRegion('" + esc(x.id) + "')"); }).join('') + '</div>';
        }
      } else if (L === 1 && r) {
        var cs = []; r.munis.forEach(function (mm) { (S.chBy.get(mm.id) || []).forEach(function (c) { cs.push({ c: c, m: mm }); }); });
        if (pub) {
          var cities = r.munis.filter(function (mm) { return S.chBy.has(mm.id); });
          html = head('Região ' + r.name, '<b>' + cs.length + '</b> capítulo(s) ativo(s) em <b>' + cities.length + '</b> de ' + r.munis.length + ' municípios.') + (cities.length ? '<p class="sub">Clique num município destacado para ver o capítulo:</p><div class="chips">' + cities.map(function (mm) { return chip(mm.name, null, "AdhMap.goMuni('" + esc(mm.id) + "')"); }).join('') + '</div>' : '<p>Ainda não há capítulo ativo publicado nesta região. Clique em um município para ver os mais próximos.</p>');
        } else {
          var cn = { active: 0, activation: 0, reactivation: 0, inactive: 0 }; cs.forEach(function (x) { cn[x.c.status]++; });
          html = head('Região ' + r.name, r.munis.length + ' municípios · ' + cs.length + ' capítulos') + '<div class="detail"><div class="statline">' + ST_ORDER.map(function (k) { return '<span><i class="sw" style="background:' + ST[k].color + '"></i>' + ST[k].label + ': <b>' + cn[k] + '</b></span>'; }).join('') + '</div></div>' + (cs.length ? '<div class="chips">' + cs.map(function (x) { return chip(x.m.name, null, "AdhMap.goMuni('" + esc(x.m.id) + "')"); }).join('') + '</div>' : '') + '<p class="sub" style="margin-top:10px">Clique em um município para isolar a cidade.</p>';
        }
        if (!pub && r.out && r.out.length) html += '<div class="fnote warn"><span><b>Atenção:</b> ' + r.out.map(function (x) { return esc(x.name); }).join(', ') + ' está vinculado a esta região mas fica longe das demais. Confira o vínculo em region_municipalities.</span></div>';
      } else if (L === 2 && m) {
        var list = S.chBy.get(m.id) || [], rn = r ? r.name : '';
        if (pub) html = head(m.name, 'Região ' + esc(rn) + ' · IBGE ' + esc(m.code)) + (list.length ? list.map(chapterCard).join('') : '<div class="detail"><strong>Ainda não há capítulo ativo em ' + esc(m.name) + '.</strong><p>Os capítulos mais próximos são:</p>' + nearHtml(m.id) + '</div>');
        else html = head(m.name, 'Região ' + esc(rn) + ' · IBGE ' + esc(m.code)) + (list.length ? list.map(chapterCard).join('') : '<div class="detail"><strong>Sem capítulo cadastrado neste município.</strong></div>');
      }
      if (L > 0) html = '<div class="actions" style="margin-bottom:8px"><button type="button" class="btn small" onclick="AdhMap.back(\'' + mode + '\')">← Voltar</button></div>' + html;
      d.innerHTML = html;
    }

    /* ---------- API pública da instância ---------- */
    api.go = go; api.back = back; api.reset = function () { S.followed = false; go(0); };
    api.goRegionId = function (id) { go(1, id); };
    api.goMuniId = function (id) { var m = S.byId.get(String(id)); if (m) go(2, m.regionId, m.id); };
    api.goRegionName = function (name) { var f = null; S.regions.forEach(function (r) { if (r.name === name) f = r; }); if (f) go(1, f.id); else go(0); };
    api.state = function () { return S; };
    api.emptyHtml = function (q) {
      if (!S.loaded) return '';
      if (S.st.level === 2 && S.st.muni && !S.chBy.has(S.st.muni)) { var m = S.byId.get(S.st.muni); return '<div class="empty"><strong>Ainda não há capítulo ativo em ' + esc(m.name) + '.</strong><p>Os capítulos mais próximos:</p>' + nearHtml(m.id) + '</div>'; }
      var n = norm(q); if (!n) return '';
      var hits = S.munis.filter(function (x) { return norm(x.name).indexOf(n) >= 0; }).slice(0, 6);
      if (hits.length) return '<div class="empty"><p>Nenhum capítulo corresponde a “' + esc(q) + '”. Você quis dizer:</p><div class="chips">' + hits.map(function (x) { return chip(x.name, null, "AdhMap.goMuni('" + esc(x.id) + "')"); }).join('') + '</div></div>';
      return '';
    };
    api.followSearch = function (q) {
      if (!S.loaded) return; var n = norm(q);
      if (!n) { if (S.followed) { S.followed = false; go(0); } return; }
      var ex = S.munis.find(function (m) { return norm(m.name) === n; });
      if (ex) { S.followed = true; if (S.st.muni !== ex.id) go(2, ex.regionId, ex.id); }
    };
    return api;
  }

  /* ===================== exposição global ===================== */
  var AdhMap = { pub: null, adm: null, utils: PURE };
  AdhMap.initPublic = function (opts) { if (!AdhMap.pub) AdhMap.pub = createMap('public'); return AdhMap.pub.load(opts); };
  AdhMap.initAdmin = function (opts) { if (!AdhMap.adm) AdhMap.adm = createMap('admin'); return AdhMap.adm.load(opts); };
  AdhMap.goMuni = function (id) { if (AdhMap.pub) AdhMap.pub.goMuniId(id); };
  AdhMap.goRegion = function (id) { if (AdhMap.pub) AdhMap.pub.goRegionId(id); };
  AdhMap.reset = function () { if (AdhMap.pub) AdhMap.pub.reset(); };
  AdhMap.back = function (mode) { var m = mode === 'admin' ? AdhMap.adm : AdhMap.pub; if (m) m.back(); };
  AdhMap.emptyHtml = function (q) { return AdhMap.pub ? AdhMap.pub.emptyHtml(q) : ''; };
  AdhMap.clearCache = function () { geoMem = null; return idbDel('geo'); };
  root.AdhMap = AdhMap;
  root.loadOfficialMap = function () { return AdhMap.initPublic(); };
  root.loadAdminMap = function () { return AdhMap.initAdmin(); };
  root.clearMapCitySelection = function () { AdhMap.reset(); };

  document.addEventListener('DOMContentLoaded', function () {
    var inp = $('findChapter'), t = null;
    if (inp) inp.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { if (AdhMap.pub) AdhMap.pub.followSearch(inp.value); }, 320); });
    var sel = $('adminRegionFocus'); if (sel) sel.addEventListener('change', function () { if (AdhMap.adm) AdhMap.adm.goRegionName(sel.value); });
  });
})(typeof window !== 'undefined' ? window : globalThis);
